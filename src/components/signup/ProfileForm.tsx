"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { useOnboardingApi, useFoundationMode } from "@/components/auth/FoundationProvider";
import { ApiHttpError } from "@/lib/api/http";
import { Badge } from "@/components/ui/Badge";
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

type SaveErrorKey = "network" | "session" | "nickname" | "invalid" | "generic";

/** 저장 실패 원인 → messages `signup.profile.form.saveErrors.<key>` */
function saveErrorKey(error: unknown): SaveErrorKey {
  if (!(error instanceof ApiHttpError)) return "network";
  if (error.status === 401) return "session";
  if (error.status === 409 || error.code.includes("NICKNAME")) return "nickname";
  if (error.status === 400 || error.status === 422) return "invalid";
  return "generic";
}

export function ProfileForm() {
  const t = useTranslations("signup.profile.form");
  const apiClient = useOnboardingApi();
  const mode = useFoundationMode();
  const [nickname, setNickname] = useState(mode === "mock" ? signup.profile.nickname : "");
  const [bio, setBio] = useState(mode === "mock" ? signup.profile.bio : "");
  const [tags, setTags] = useState<string[]>(mode === "mock" ? ["DEV", "DESIGN"] : []);
  const [state, setState] = useState<"idle" | "pending" | "error">("idle");
  // 필드 검증 에러. 저장 실패(state "error", 예: 닉네임 중복)와는 따로 표시한다.
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<"nickname" | "tags" | "bio", true>>>({});
  const [saveError, setSaveError] = useState<SaveErrorKey>("generic");

  const toggleTag = (value: string) => {
    setTags((current) =>
      current.includes(value) ? current.filter((tag) => tag !== value) : [...current, value],
    );
    setFieldErrors((current) => ({ ...current, tags: undefined }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = {
      ...(nickname.trim().length < 2 ? { nickname: true as const } : {}),
      ...(tags.length === 0 ? { tags: true as const } : {}),
      ...(!bio.trim() ? { bio: true as const } : {}),
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

    setState("pending");
    onboardingLog("profile.save.started", {
      nicknameLength: nickname.trim().length,
      bioLength: bio.trim().length,
      tagCount: tags.length,
    });
    try {
      await apiClient.completeProfile({ nickname: nickname.trim(), bio: bio.trim(), tags });
      onboardingLog("profile.save.succeeded", { targetPath: "/signup/get-started" });
      window.location.assign(withLocaleOf(window.location.pathname, "/signup/get-started"));
    } catch (error) {
      onboardingLog("profile.save.failed", onboardingErrorDetails(error));
      setSaveError(saveErrorKey(error));
      setState("error");
    }
  };

  return (
    <form className="mt-6 space-y-5" noValidate onSubmit={(event) => void submit(event)}>
      <div>
        <label className="text-sm font-semibold text-ink" htmlFor="nickname">
          {t("nicknameLabel")}
        </label>
        <input
          className="mt-2 w-full rounded-control border border-border bg-surface px-4 py-3 text-sm text-ink-secondary placeholder:text-ink-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          id="nickname"
          maxLength={50}
          minLength={2}
          name="nickname"
          aria-describedby={fieldErrors.nickname ? "nickname-error" : undefined}
          aria-invalid={fieldErrors.nickname || undefined}
          onChange={(event) => {
            setNickname(event.target.value);
            setFieldErrors((current) => ({ ...current, nickname: undefined }));
          }}
          placeholder={t("nicknamePlaceholder")}
          required
          value={nickname}
        />
        {fieldErrors.nickname ? <p className="mt-2 text-xs text-danger" id="nickname-error">{t("errors.nickname")}</p> : null}
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
        {fieldErrors.tags ? <p className="mt-2 text-xs text-danger">{t("errors.tags")}</p> : null}
      </fieldset>
      <div>
        <label className="text-sm font-semibold text-ink" htmlFor="bio">
          {t("bioLabel")}
        </label>
        <textarea
          className="mt-2 min-h-[120px] w-full rounded-control border border-border bg-surface px-4 py-3 text-sm text-ink-secondary placeholder:text-ink-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          id="bio"
          name="bio"
          aria-describedby={fieldErrors.bio ? "bio-error bio-hint" : "bio-hint"}
          aria-invalid={fieldErrors.bio || undefined}
          onChange={(event) => {
            setBio(event.target.value);
            setFieldErrors((current) => ({ ...current, bio: undefined }));
          }}
          placeholder={t("bioPlaceholder")}
          required
          value={bio}
        />
        {fieldErrors.bio ? <p className="mt-2 text-xs text-danger" id="bio-error">{t("errors.bio")}</p> : null}
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
          {t(`saveErrors.${saveError}`)}
        </p>
      ) : null}
    </form>
  );
}
