"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuthActions, useAuthSnapshot, useOnboardingApi, useFoundationMode } from "@/components/auth/FoundationProvider";
import { ERROR_COPY, knownCode } from "@/lib/api/error-copy";
import { ApiHttpError } from "@/lib/api/http";
import { validationFieldsFromError } from "@/lib/api/validation";
import { Badge } from "@/components/ui/Badge";
import { NICKNAME_MAX, NICKNAME_MIN, normalizeNickname, validateNickname } from "@/lib/nickname";
import { PROFILE_BIO_MAX } from "@/lib/input-limits";
import { pushFlash } from "@/lib/flash";
import { signup } from "@/lib/signup";
import { onboardingErrorDetails, onboardingLog } from "@/lib/onboarding-log";
import { withLocaleOf } from "@/i18n/routing";

// `labelKey` resolves under messages `signup.profile.form.tags`; `value` is sent to the API.
const fieldTags = [
  { labelKey: "dev", value: "DEV" },
  { labelKey: "design", value: "DESIGN" },
  { labelKey: "content", value: "CONTENT" },
  { labelKey: "other", value: "OTHER" },
] as const;

/** 저장 실패 문구 키 (`signup.profile.form.saveErrors.<key>`): 코드 키는 `ERROR_COPY.profileSave`, 나머지는 아래 상태 규칙. */
type SaveErrorKey = (typeof ERROR_COPY.profileSave.codes)[number] | "network" | "session" | "invalid" | "generic";

/** 닉네임 입력 후 중복 검사까지 기다리는 시간 (ms) — BE `check-nickname`은 30/min throttle이다 */
export const NICKNAME_CHECK_DEBOUNCE_MS = 400;

/** 필드별 에러의 messages 키 (`signup.profile.form` 아래) */
type FieldErrors = Partial<Record<"nickname" | "tags" | "bio", string>>;
/** 마지막으로 끝난 중복 검사. `available: null`은 요청 실패(429 등) — 막지 않고 BE 저장에 맡긴다. */
type NicknameCheck = { nickname: string; available: boolean | null };

/**
 * 저장 실패 원인 → messages `signup.profile.form.saveErrors.<key>`. 순서가 규칙이다:
 * 네트워크 → 401 세션 만료 → 전용 문구가 있는 BE 코드 → 코드 없는 409(닉네임 충돌로 간주) → 400/422 입력 오류 → 그 외.
 */
export function saveErrorKey(error: unknown): SaveErrorKey {
  if (!(error instanceof ApiHttpError)) return "network";
  if (error.status === 401) return "session";
  const code = knownCode(error, ERROR_COPY.profileSave.codes);
  if (code) return code;
  if (error.status === 409) return "NICKNAME_TAKEN";
  if (error.status === 400 || error.status === 422) return "invalid";
  return ERROR_COPY.profileSave.fallback;
}

/**
 * Onboarding draft kept across a session that ended mid-form: the sign-in goes through Google and back (same tab), so
 * sessionStorage survives it. Public profile text only, no secrets; cleared on a successful save.
 */
const DRAFT_KEY = "ninja.profileDraft";
type Draft = { nickname: string; bio: string; tags: string[] };

function readDraft(): Draft | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const { nickname, bio, tags } = value as Record<string, unknown>;
    if (typeof nickname !== "string" || typeof bio !== "string" || !Array.isArray(tags)) return null;
    return { nickname, bio, tags: tags.filter((tag): tag is string => fieldTags.some((known) => known.value === tag)) };
  } catch {
    return null;
  }
}

function writeDraft(draft: Draft | null): void {
  try {
    if (draft) window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // storage blocked: the form on screen still keeps what was typed
  }
}

type ProfileFormProps = {
  /**
   * `onboarding` (default): signup step 3, saves and continues to step 4. `edit`: the account page, prefilled from the signed-in
   * user; saving re-reads the session and calls `onSaved` instead of navigating. Same fields, same rules, same BE endpoint.
   */
  mode?: "onboarding" | "edit";
  onSaved?: () => void;
};

export function ProfileForm({ mode: formMode = "onboarding", onSaved }: ProfileFormProps = {}) {
  const editing = formMode === "edit";
  const t = useTranslations("signup.profile.form");
  const tSaveErrors = useTranslations(ERROR_COPY.profileSave.messages);
  const apiClient = useOnboardingApi();
  const mode = useFoundationMode();
  const auth = useAuthSnapshot();
  const { refresh } = useAuthActions();
  const signedInUser = auth.status === "signed-in" ? auth.user : null;
  // Signed in earlier on this form and signed out now (session revoked/expired, or another tab signed out): keep the form
  // on screen with the typed values and say so, instead of sending the user to the login page empty-handed.
  const [wasSignedIn, setWasSignedIn] = useState(false);
  if (signedInUser && !wasSignedIn) setWasSignedIn(true);
  const sessionEnded = mode === "api" && wasSignedIn && auth.status === "signed-out" && auth.reason === "session-ended";
  // Onboarding only: a draft left by an ended session pre-fills the form once the user is back.
  const [draft] = useState(() => (!editing && mode === "api" && typeof window !== "undefined" ? readDraft() : null));
  // Edit mode starts from what is saved; onboarding starts empty (mock mode prefills a demo profile).
  const [nickname, setNickname] = useState(editing && signedInUser ? signedInUser.handle : draft ? draft.nickname : mode === "mock" ? signup.profile.nickname : "");
  const [bio, setBio] = useState(editing && signedInUser ? signedInUser.bio ?? "" : draft ? draft.bio : mode === "mock" ? signup.profile.bio : "");
  const [tags, setTags] = useState<string[]>(editing && signedInUser ? [...(signedInUser.tags ?? [])] : draft ? draft.tags : mode === "mock" ? ["DEV", "DESIGN"] : []);
  const [saved, setSaved] = useState(false);
  const [state, setState] = useState<"idle" | "pending" | "error">("idle");
  // 필드 검증 에러. 저장 실패(state "error", 예: 닉네임 중복)와는 따로 표시한다.
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  // Synchronous in-flight guard: several submit events can land in one tick before React re-renders the disabled button.
  const inFlight = useRef(false);
  const [saveError, setSaveError] = useState<SaveErrorKey>("generic");
  const [nicknameCheck, setNicknameCheck] = useState<NicknameCheck | null>(null);

  const trimmedNickname = normalizeNickname(nickname);
  const nicknameRuleError = validateNickname(trimmedNickname);
  // 이미 저장한 내 닉네임(뒤로 가기·재방문)은 BE `check-nickname`(공개, 익명)에게 "사용 중"이지만 저장은 허용된다(자기 행 UPDATE).
  // 그 값은 묻지도 막지도 않는다. BE 비교는 대소문자 무시(`lower(nickname)`).
  const ownNickname = auth.status === "signed-in" ? normalizeNickname(auth.user.handle).toLowerCase() : null;
  const isOwnNickname = ownNickname !== null && trimmedNickname.toLowerCase() === ownNickname;
  // 규칙을 통과한 값만 BE에 묻는다; 마지막 검사 결과가 현재 입력과 다르면 아직 확인 중이다.
  // A typed name that breaks a rule says why right away (no request is sent for it, so the status line would stay empty and
  // the field would look fine); an empty field is only reported on save.
  const nicknameStatus: "idle" | "invalid" | "checking" | "available" | "taken" = nicknameRuleError && trimmedNickname !== ""
    ? "invalid"
    : nicknameRuleError || isOwnNickname
    ? "idle"
    : nicknameCheck?.nickname !== trimmedNickname
      ? "checking"
      : nicknameCheck.available === null
        ? "idle"
        : nicknameCheck.available
          ? "available"
          : "taken";

  // Onboarding keeps what was typed for the whole step, not only after a session ended: a language switch (a new
  // `[locale]` route) or a reload remounts the form, and the draft refills it. Cleared on a successful save.
  useEffect(() => {
    if (editing || mode !== "api") return;
    writeDraft(nickname || bio || tags.length > 0 ? { nickname, bio, tags } : null);
  }, [editing, mode, nickname, bio, tags]);

  useEffect(() => {
    if (nicknameRuleError || isOwnNickname) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      apiClient
        .checkNickname(trimmedNickname)
        .then((result) => {
          if (!cancelled) setNicknameCheck({ nickname: trimmedNickname, available: result.available });
        })
        .catch(() => {
          if (!cancelled) setNicknameCheck({ nickname: trimmedNickname, available: null });
        });
    }, NICKNAME_CHECK_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [apiClient, isOwnNickname, nicknameRuleError, trimmedNickname]);

  const toggleTag = (value: string) => {
    setSaved(false);
    setTags((current) =>
      current.includes(value) ? current.filter((tag) => tag !== value) : [...current, value],
    );
    setFieldErrors((current) => ({ ...current, tags: undefined }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    const nextErrors: FieldErrors = {
      // A non-empty rule violation is already said by the status line under the field (`nickname-status`).
      ...(nicknameRuleError && nicknameStatus !== "invalid" ? { nickname: `nicknameErrors.${nicknameRuleError}` } : {}),
      ...(tags.length === 0 ? { tags: "errors.tags" } : {}),
      ...(!bio.trim() ? { bio: "errors.bio" } : {}),
    };
    setFieldErrors(nextErrors);
    // A taken nickname is announced once, by the status line under the field (`nickname-status`), not again as a field error.
    if (Object.keys(nextErrors).length > 0 || nicknameStatus === "taken" || nicknameStatus === "invalid") {
      onboardingLog("profile.validation.failed", {
        nicknameLength: nickname.trim().length,
        bioLength: bio.trim().length,
        tagCount: tags.length,
      });
      setState("idle");
      return;
    }

    inFlight.current = true;
    setState("pending");
    onboardingLog("profile.save.started", {
      nicknameLength: nickname.trim().length,
      bioLength: bio.trim().length,
      tagCount: tags.length,
    });
    try {
      await apiClient.completeProfile({ nickname: trimmedNickname, bio: bio.trim(), tags });
      if (editing) {
        onboardingLog("profile.save.succeeded", { targetPath: "(account)" });
        // The session snapshot carries nickname, bio and tags: re-read it so the header, the profile link and this form agree.
        await refresh?.().catch(() => undefined);
        setSaved(true);
        setState("idle");
        inFlight.current = false;
        // The account page closes this form on `onSaved`, so an inline status would never be seen: confirm with a toast.
        pushFlash("profileSaved");
        onSaved?.();
        return;
      }
      onboardingLog("profile.save.succeeded", { targetPath: "/signup/get-started" });
      writeDraft(null);
      window.location.assign(withLocaleOf(window.location.pathname, "/signup/get-started"));
    } catch (error) {
      onboardingLog("profile.save.failed", onboardingErrorDetails(error));
      const key = saveErrorKey(error);
      // BE 400 VALIDATION_FAILED의 message[]가 가리키는 필드를 인라인 힌트로 돌려준다 (원문 영어는 보여 주지 않는다).
      const rejected = validationFieldsFromError(error);
      setFieldErrors({
        ...("nickname" in rejected ? { nickname: nicknameRuleError ? `nicknameErrors.${nicknameRuleError}` : "errors.nicknameRejected" } : {}),
        ...("bio" in rejected ? { bio: bio.trim() ? "errors.bioRejected" : "errors.bio" } : {}),
        ...("tags" in rejected ? { tags: "errors.tags" } : {}),
      });
      if (key === "NICKNAME_TAKEN") setNicknameCheck({ nickname: trimmedNickname, available: false });
      setSaveError(key);
      // NICKNAME_TAKEN is already said by the status line under the field, and a 400 whose fields are named is said by
      // those inline hints; a form-level alert would repeat it in other words (two alerts for one rejected bio).
      setState(key === "NICKNAME_TAKEN" || (key === "invalid" && Object.keys(rejected).length > 0) ? "idle" : "error");
      inFlight.current = false;
    }
  };

  const nicknameDescribedBy = [
    fieldErrors.nickname ? "nickname-error" : null,
    nicknameStatus === "idle" ? null : "nickname-status",
    "nickname-hint",
  ].filter(Boolean).join(" ");

  return (
    <form className="mt-6 space-y-5" noValidate onSubmit={(event) => void submit(event)}>
      <div>
        <label className="text-sm font-semibold text-ink" htmlFor="nickname">
          {t("nicknameLabel")}
        </label>
        <input
          className="mt-2 w-full rounded-control border border-border bg-surface px-4 py-3 text-sm text-ink-secondary placeholder:text-ink-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          id="nickname"
          maxLength={NICKNAME_MAX}
          minLength={NICKNAME_MIN}
          name="nickname"
          aria-describedby={nicknameDescribedBy}
          aria-invalid={fieldErrors.nickname || nicknameStatus === "taken" || nicknameStatus === "invalid" ? true : undefined}
          onChange={(event) => {
            setNickname(event.target.value);
            setSaved(false);
            setFieldErrors((current) => ({ ...current, nickname: undefined }));
          }}
          placeholder={t("nicknamePlaceholder")}
          required
          value={nickname}
        />
        {fieldErrors.nickname ? <p className="mt-2 text-xs text-danger" id="nickname-error" role="alert">{t(fieldErrors.nickname)}</p> : null}
        <p aria-live="polite" className={nicknameStatus === "taken" || nicknameStatus === "invalid" ? "mt-2 text-xs text-danger" : nicknameStatus === "available" ? "mt-2 text-xs text-success" : "mt-2 text-xs text-ink-muted"} id="nickname-status" role="status">
          {nicknameStatus === "idle" ? "" : nicknameStatus === "invalid" && nicknameRuleError ? t(`nicknameErrors.${nicknameRuleError}`) : t(`nicknameCheck.${nicknameStatus}`)}
        </p>
        <p className="mt-1 text-xs text-ink-muted" id="nickname-hint">{t("nicknameHint")}</p>
      </div>
      <fieldset>
        <legend className="text-sm font-semibold text-ink">{t("fieldTags")}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {fieldTags.map((tag) => {
            const selected = tags.includes(tag.value);
            return (
              <button
                aria-pressed={selected}
                className="max-sm:inline-flex max-sm:min-h-10 max-sm:items-center"
                key={tag.value}
                onClick={() => toggleTag(tag.value)}
                type="button"
              >
                <Badge variant={selected ? "selected" : "primary-soft"}>{t(`tags.${tag.labelKey}`)}</Badge>
              </button>
            );
          })}
        </div>
        {fieldErrors.tags ? <p className="mt-2 text-xs text-danger" role="alert">{t(fieldErrors.tags)}</p> : null}
      </fieldset>
      <div>
        <label className="text-sm font-semibold text-ink" htmlFor="bio">
          {t("bioLabel")}
        </label>
        <textarea
          className="mt-2 min-h-[120px] w-full rounded-control border border-border bg-surface px-4 py-3 text-sm text-ink-secondary placeholder:text-ink-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          id="bio"
          maxLength={PROFILE_BIO_MAX}
          name="bio"
          aria-describedby={fieldErrors.bio ? "bio-error bio-hint" : "bio-hint"}
          aria-invalid={fieldErrors.bio ? true : undefined}
          onChange={(event) => {
            setBio(event.target.value);
            setSaved(false);
            setFieldErrors((current) => ({ ...current, bio: undefined }));
          }}
          placeholder={t("bioPlaceholder")}
          required
          value={bio}
        />
        {fieldErrors.bio ? <p className="mt-2 text-xs text-danger" id="bio-error" role="alert">{t(fieldErrors.bio)}</p> : null}
        <p className="mt-2 text-xs text-ink-muted" id="bio-hint">{t("bioHint")}</p>
      </div>
      <button
        className="block w-full rounded-control bg-primary px-5 py-3 text-center text-base font-semibold text-on-inverse hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
        disabled={state === "pending"}
        type="submit"
      >
        {state === "pending" ? t("saving") : editing ? t("save") : t("submit")}
      </button>
      {saved ? <p className="text-sm font-semibold text-success" role="status">{t("saved")}</p> : null}
      {sessionEnded ? (
        <div className="space-y-2" role="alert">
          <p className="text-sm text-danger">{tSaveErrors("session")}</p>
          <Link className="inline-block text-sm font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href="/signup">
            {t("signInAgain")}
          </Link>
        </div>
      ) : state === "error" ? (
        <p className="text-sm text-danger" role="alert">
          {tSaveErrors(saveError)}
        </p>
      ) : null}
    </form>
  );
}
