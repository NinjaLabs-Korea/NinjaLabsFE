"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { useOnboardingApi, useFoundationMode } from "@/components/auth/FoundationProvider";
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

export function ProfileForm() {
  const t = useTranslations("signup.profile.form");
  const apiClient = useOnboardingApi();
  const mode = useFoundationMode();
  const [nickname, setNickname] = useState(mode === "mock" ? signup.profile.nickname : "");
  const [bio, setBio] = useState(mode === "mock" ? signup.profile.bio : "");
  const [tags, setTags] = useState<string[]>(mode === "mock" ? ["DEV", "DESIGN"] : []);
  const [state, setState] = useState<"idle" | "pending" | "error">("idle");

  const toggleTag = (value: string) => {
    setTags((current) =>
      current.includes(value) ? current.filter((tag) => tag !== value) : [...current, value],
    );
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!nickname.trim() || !bio.trim() || tags.length === 0) {
      onboardingLog("profile.validation.failed", {
        nicknameLength: nickname.trim().length,
        bioLength: bio.trim().length,
        tagCount: tags.length,
      });
      setState("error");
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
      setState("error");
    }
  };

  return (
    <form className="mt-6 space-y-5" onSubmit={(event) => void submit(event)}>
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
          onChange={(event) => setNickname(event.target.value)}
          placeholder={t("nicknamePlaceholder")}
          required
          value={nickname}
        />
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
      </fieldset>
      <div>
        <label className="text-sm font-semibold text-ink" htmlFor="bio">
          {t("bioLabel")}
        </label>
        <textarea
          className="mt-2 min-h-[120px] w-full rounded-control border border-border bg-surface px-4 py-3 text-sm text-ink-secondary placeholder:text-ink-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          id="bio"
          name="bio"
          onChange={(event) => setBio(event.target.value)}
          placeholder={t("bioPlaceholder")}
          required
          value={bio}
        />
        <p className="mt-2 text-xs text-ink-muted">{t("bioHint")}</p>
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
          {t("error")}
        </p>
      ) : null}
    </form>
  );
}
