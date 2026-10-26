"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuthSnapshot, useOnboardingApi, useFoundationMode } from "@/components/auth/FoundationProvider";
import { ERROR_COPY, knownCode } from "@/lib/api/error-copy";
import { ApiHttpError } from "@/lib/api/http";
import { validationFieldsFromError } from "@/lib/api/validation";
import { Badge } from "@/components/ui/Badge";
import { NICKNAME_MAX, NICKNAME_MIN, normalizeNickname, validateNickname } from "@/lib/nickname";
import { PROFILE_BIO_MAX } from "@/lib/input-limits";
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

export function ProfileForm() {
  const t = useTranslations("signup.profile.form");
  const tSaveErrors = useTranslations(ERROR_COPY.profileSave.messages);
  const apiClient = useOnboardingApi();
  const mode = useFoundationMode();
  const auth = useAuthSnapshot();
  const [nickname, setNickname] = useState(mode === "mock" ? signup.profile.nickname : "");
  const [bio, setBio] = useState(mode === "mock" ? signup.profile.bio : "");
  const [tags, setTags] = useState<string[]>(mode === "mock" ? ["DEV", "DESIGN"] : []);
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
  const nicknameStatus: "idle" | "checking" | "available" | "taken" = nicknameRuleError || isOwnNickname
    ? "idle"
    : nicknameCheck?.nickname !== trimmedNickname
      ? "checking"
      : nicknameCheck.available === null
        ? "idle"
        : nicknameCheck.available
          ? "available"
          : "taken";

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
    setTags((current) =>
      current.includes(value) ? current.filter((tag) => tag !== value) : [...current, value],
    );
    setFieldErrors((current) => ({ ...current, tags: undefined }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    const nextErrors: FieldErrors = {
      ...(nicknameRuleError
        ? { nickname: `nicknameErrors.${nicknameRuleError}` }
        : nicknameStatus === "taken"
          ? { nickname: "nicknameCheck.taken" }
          : {}),
      ...(tags.length === 0 ? { tags: "errors.tags" } : {}),
      ...(!bio.trim() ? { bio: "errors.bio" } : {}),
    };
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
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
      onboardingLog("profile.save.succeeded", { targetPath: "/signup/get-started" });
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
        ...(key === "NICKNAME_TAKEN" ? { nickname: "nicknameCheck.taken" } : {}),
      });
      if (key === "NICKNAME_TAKEN") setNicknameCheck({ nickname: trimmedNickname, available: false });
      setSaveError(key);
      setState("error");
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
          aria-invalid={fieldErrors.nickname ? true : undefined}
          onChange={(event) => {
            setNickname(event.target.value);
            setFieldErrors((current) => ({ ...current, nickname: undefined }));
          }}
          placeholder={t("nicknamePlaceholder")}
          required
          value={nickname}
        />
        {fieldErrors.nickname ? <p className="mt-2 text-xs text-danger" id="nickname-error" role="alert">{t(fieldErrors.nickname)}</p> : null}
        <p aria-live="polite" className={nicknameStatus === "taken" ? "mt-2 text-xs text-danger" : nicknameStatus === "available" ? "mt-2 text-xs text-success" : "mt-2 text-xs text-ink-muted"} id="nickname-status" role="status">
          {nicknameStatus === "idle" ? "" : t(`nicknameCheck.${nicknameStatus}`)}
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
        {state === "pending" ? t("saving") : t("submit")}
      </button>
      {state === "error" ? (
        <p className="text-sm text-danger" role="alert">
          {tSaveErrors(saveError)}
        </p>
      ) : null}
    </form>
  );
}
