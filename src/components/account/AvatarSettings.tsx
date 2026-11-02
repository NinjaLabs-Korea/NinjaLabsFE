"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { useAccountSettingsApi, useAuthActions, useFoundationMode } from "@/components/auth/FoundationProvider";
import { Avatar } from "@/components/ui/Avatar";
import { useSingleFlight } from "@/components/ui/useSingleFlight";
import { getAccessToken } from "@/lib/api/http";
import { ERROR_COPY, knownCode } from "@/lib/api/error-copy";
import { AVATAR_ACCEPTED_TYPES, avatarFileProblem } from "@/lib/avatar";
import type { ClientUser } from "@/lib/contracts/auth";
import { refreshMemberLists } from "@/lib/member-revalidate";

const focusClass = "hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const primaryButtonClass = `rounded-control bg-primary px-4 py-2 max-sm:py-2.5 text-sm font-semibold text-on-inverse disabled:opacity-60 ${focusClass}`;
const secondaryButtonClass = `rounded-control border border-primary-outline px-4 py-2 max-sm:py-2.5 text-sm font-semibold text-primary-strong disabled:opacity-60 ${focusClass}`;
const dangerTextButtonClass = `rounded-control px-4 py-2 max-sm:py-2.5 text-sm font-semibold text-danger hover:bg-danger-soft disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`;

const avatarErrors = ERROR_COPY.avatarUpload;
type AvatarError = (typeof avatarErrors.codes)[number] | "generic" | "removeFailed";

/**
 * `/account` profile photo: pick a file (checked here with the BE rules first), preview it, then save (`POST /users/me/avatar`)
 * or cancel; remove the current photo (`DELETE /users/me/avatar`). After a change the signed-in user is re-read (`refresh()`), so
 * the header chip, `/home` and the session chip hint show the new photo, and the cached public member list is expired.
 */
export function AvatarSettings({ user }: { user: ClientUser }) {
  const t = useTranslations("account.settings.avatar");
  const tErrors = useTranslations(avatarErrors.messages);
  const settingsApi = useAccountSettingsApi();
  const { refresh } = useAuthActions();
  const mode = useFoundationMode();
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const [pending, setPending] = useState<{ file: File; previewUrl: string } | null>(null);
  const [error, setError] = useState<AvatarError | null>(null);
  const [done, setDone] = useState<"saved" | "removed" | null>(null);
  const upload = useSingleFlight();
  const removal = useSingleFlight();
  const busy = upload.busy || removal.busy;

  // The preview is a blob URL: release it when it is replaced, cancelled or the card unmounts.
  useEffect(() => () => {
    if (pending) URL.revokeObjectURL(pending.previewUrl);
  }, [pending]);

  const afterChange = async (result: "saved" | "removed") => {
    setDone(result);
    await refresh?.();
    if (mode === "api") void refreshMemberLists(getAccessToken()).catch(() => undefined);
  };

  const pick = (file: File | undefined) => {
    setDone(null);
    if (!file) return;
    const problem = avatarFileProblem(file);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setPending({ file, previewUrl: URL.createObjectURL(file) });
  };

  const save = () => {
    if (!pending) return;
    void upload.run(async () => {
      setError(null);
      try {
        await settingsApi.uploadAvatar(pending.file);
      } catch (caught) {
        setError(knownCode(caught, avatarErrors.codes) ?? avatarErrors.fallback);
        return;
      }
      // Keep the preview until the re-read user carries the new photo, so the circle never flashes the old one.
      await afterChange("saved");
      setPending(null);
    });
  };

  const remove = () => {
    void removal.run(async () => {
      setError(null);
      setDone(null);
      try {
        await settingsApi.removeAvatar();
      } catch (caught) {
        setError(knownCode(caught, avatarErrors.codes) ?? "removeFailed");
        return;
      }
      await afterChange("removed");
    });
  };

  const shown = pending?.previewUrl ?? user.avatarUrl;

  return (
    <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center" data-testid="avatar-settings">
      <Avatar avatarUrl={shown} initials={user.initials} sizeClass="size-20" sizes="80px" textClass="text-2xl font-bold" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{t("label")}</p>
        <p className="mt-1 text-sm text-ink-muted" id={hintId}>{pending ? t("previewNote") : t("hint")}</p>
        <input
          accept={AVATAR_ACCEPTED_TYPES.join(",")}
          aria-describedby={hintId}
          aria-label={t("label")}
          className="sr-only"
          disabled={busy}
          onChange={(event) => {
            pick(event.target.files?.[0]);
            event.target.value = ""; // picking the same file again after a cancel must fire onChange
          }}
          ref={inputRef}
          tabIndex={-1}
          type="file"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {pending ? (
            <>
              <button className={primaryButtonClass} disabled={busy} onClick={save} type="button">
                {upload.busy ? t("saving") : t("save")}
              </button>
              <button
                className={secondaryButtonClass}
                disabled={busy}
                onClick={() => {
                  setPending(null);
                  setError(null);
                }}
                type="button"
              >
                {t("cancel")}
              </button>
            </>
          ) : (
            <>
              <button aria-describedby={hintId} className={secondaryButtonClass} disabled={busy} onClick={() => inputRef.current?.click()} type="button">
                {user.avatarUrl ? t("change") : t("choose")}
              </button>
              {user.avatarUrl ? (
                <button className={dangerTextButtonClass} disabled={busy} onClick={remove} type="button">
                  {removal.busy ? t("removing") : t("remove")}
                </button>
              ) : null}
            </>
          )}
        </div>
        <p aria-live="polite" className="mt-2 text-sm text-ink-muted" role="status">
          {upload.busy ? t("saving") : removal.busy ? t("removing") : done ? t(done) : ""}
        </p>
        {error ? (
          <p className="mt-1 text-sm font-semibold text-danger" role="alert">
            {error === "removeFailed" ? t("removeFailed") : tErrors(error)}
          </p>
        ) : null}
        {mode === "mock" ? <p className="mt-1 text-xs text-ink-muted">{t("mockNote")}</p> : null}
      </div>
    </div>
  );
}
