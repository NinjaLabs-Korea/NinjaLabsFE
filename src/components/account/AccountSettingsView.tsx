"use client";

import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { SignedOutPanel } from "@/components/account/SignedOutPanel";
import {
  useAccountSettingsApi,
  useAuthActions,
  useAuthSnapshot,
  useFoundationMode,
} from "@/components/auth/FoundationProvider";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useRouter } from "@/i18n/navigation";
import { pushFlash } from "@/lib/flash";

const focusClass =
  "hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const dangerButtonClass = `rounded-control border border-danger-soft bg-danger-soft px-4 py-2 text-sm font-semibold text-danger disabled:opacity-60 ${focusClass}`;

/** Same rule as the BE (`DELETE /users/me`): trimmed, case-insensitive. */
export function confirmationMatches(nickname: string, typed: string): boolean {
  return typed.trim().length > 0 && typed.trim().toLowerCase() === nickname.trim().toLowerCase();
}

/** BE error codes with their own copy under `account.settings.deleteErrors`; anything else is `generic`. */
const knownErrors = [
  "CONFIRM_NICKNAME_MISMATCH",
  "WITHDRAWAL_BLOCKED_OPEN_PAYOUTS",
  // 409: approved rewards not yet requested as a payout; withdrawing would forfeit them, so an admin must pay first.
  "WITHDRAWAL_BLOCKED_PENDING_REWARDS",
  // 503 from any endpoint when the BE cannot reach its database: transient, retry later.
  "DATABASE_UNAVAILABLE",
] as const;
type KnownError = (typeof knownErrors)[number];

export function AccountSettingsView() {
  const t = useTranslations("account.settings");
  const tAccount = useTranslations("account.common");
  const authSnapshot = useAuthSnapshot();
  const mode = useFoundationMode();
  const settingsApi = useAccountSettingsApi();
  const { signOut } = useAuthActions();
  const router = useRouter();
  const inputId = useId();
  const errorId = useId();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<KnownError | "generic" | null>(null);
  // Synchronous guard: a second click lands before the `busy` state update.
  const pendingRef = useRef(false);

  if (authSnapshot.status === "signed-out") {
    return <SignedOutPanel message={t("signedOutMessage")} />;
  }

  if (authSnapshot.status !== "signed-in") {
    return <p className="text-sm text-ink-muted" role="status">{tAccount("loading")}</p>;
  }

  const { user } = authSnapshot;
  const nickname = user.handle;
  const matches = confirmationMatches(nickname, typed);

  const closeDialog = () => {
    if (pendingRef.current) return;
    setDialogOpen(false);
    setTyped("");
    setError(null);
  };

  const deleteAccount = async () => {
    if (pendingRef.current || !matches) return;
    pendingRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await settingsApi.withdrawAccount(typed.trim());
    } catch (caught) {
      const code = (caught as { code?: unknown }).code;
      setError(knownErrors.includes(code as KnownError) ? (code as KnownError) : "generic");
      pendingRef.current = false;
      setBusy(false);
      return;
    }
    // The BE already revoked every session; signOut clears the cookie (POST /api/auth/logout) and the local state.
    pushFlash("accountDeleted");
    try {
      await signOut();
    } finally {
      router.replace("/");
    }
  };

  return (
    <div className="space-y-8">
      <section aria-labelledby={`${inputId}-profile`} className="rounded-card border border-border bg-surface p-6 shadow-card">
        <h2 className="font-display text-xl font-bold text-ink" id={`${inputId}-profile`}>{t("profileHeading")}</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-[160px_1fr]">
          <dt className="text-ink-muted">{t("nicknameLabel")}</dt>
          <dd className="font-semibold text-ink">{nickname}</dd>
          {user.walletAddress ? (
            <>
              <dt className="text-ink-muted">{t("walletLabel")}</dt>
              <dd className="break-all font-semibold text-ink">{user.walletAddress}</dd>
            </>
          ) : null}
        </dl>
      </section>

      <section aria-labelledby={`${inputId}-danger`} className="rounded-card border border-danger-soft bg-surface p-6">
        <p className="text-xs font-bold uppercase tracking-[0.96px] text-danger">{t("dangerEyebrow")}</p>
        <h2 className="mt-2 font-display text-xl font-bold text-ink" id={`${inputId}-danger`}>{t("deleteHeading")}</h2>
        <p className="mt-2 text-sm text-ink-muted">{t("deleteBody")}</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-muted">
          <li>{t("deleteConsequences.sessions")}</li>
          <li>{t("deleteConsequences.agents")}</li>
          <li>{t("deleteConsequences.history")}</li>
          <li>{t("deleteConsequences.rewards")}</li>
        </ul>
        <button className={`mt-5 ${dangerButtonClass}`} onClick={() => setDialogOpen(true)} type="button">
          {t("deleteAction")}
        </button>
        {mode === "mock" ? <p className="mt-3 text-xs text-ink-muted">{tAccount("mockNote")}</p> : null}
      </section>

      <ConfirmDialog
        calloutText={t("deleteDialog.callout")}
        confirmDisabled={!matches || busy}
        confirmLabel={busy ? t("deleteDialog.deleting") : t("deleteDialog.confirm")}
        description={t("deleteDialog.description")}
        destructive
        eyebrow={t("deleteDialog.eyebrow")}
        onCancel={closeDialog}
        onConfirm={() => void deleteAccount()}
        open={dialogOpen}
        title={t("deleteDialog.title")}
      >
        <label className="mt-4 block text-sm font-semibold text-ink" htmlFor={inputId}>
          {t("deleteDialog.inputLabel", { nickname })}
        </label>
        <input
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error === "CONFIRM_NICKNAME_MISMATCH" ? true : undefined}
          autoCapitalize="off"
          autoComplete="off"
          className="mt-2 w-full rounded-control border border-border bg-surface px-4 py-3 text-sm text-ink-secondary placeholder:text-ink-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          disabled={busy}
          id={inputId}
          onChange={(event) => {
            setTyped(event.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void deleteAccount();
            }
          }}
          placeholder={nickname}
          spellCheck={false}
          type="text"
          value={typed}
        />
        {error ? (
          <p className="mt-2 text-sm font-semibold text-danger" id={errorId} role="alert">
            {t(`deleteErrors.${error}`)}
          </p>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
