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
import { MyCohortApplications } from "@/components/account/MyCohortApplications";
import { WalletSettings } from "@/components/account/WalletSettings";
import { ProfileForm } from "@/components/signup/ProfileForm";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useRouter } from "@/i18n/navigation";
import { ERROR_COPY, knownCode } from "@/lib/api/error-copy";
import { pushFlash } from "@/lib/flash";
import { normalizeNickname } from "@/lib/nickname";
import type { WalletConfig } from "@/lib/runtime/config";

const focusClass =
  "hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const secondaryButtonClass = `rounded-control border border-primary-outline px-4 py-2 max-sm:py-2.5 text-sm font-semibold text-primary-strong ${focusClass}`;
const dangerButtonClass = `rounded-control border border-danger-soft bg-danger-soft px-4 py-2 max-sm:py-2.5 text-sm font-semibold text-danger disabled:opacity-60 ${focusClass}`;

/** Same rule as the BE (`DELETE /users/me`): trimmed, NFC-normalized, case-insensitive. */
export function confirmationMatches(nickname: string, typed: string): boolean {
  const normalized = normalizeNickname(typed);
  return normalized.length > 0 && normalized.toLowerCase() === normalizeNickname(nickname).toLowerCase();
}

/** BE error codes with their own copy under `account.settings.deleteErrors` (목록: `ERROR_COPY.accountDelete`); anything else is `generic`. */
const deleteErrors = ERROR_COPY.accountDelete;
type KnownError = (typeof deleteErrors.codes)[number];

export function AccountSettingsView({ wallet = null }: { /** Injective EVM chain config for the wallet card (server-composed runtime config); null → no wallet connect here. */ wallet?: WalletConfig | null } = {}) {
  const t = useTranslations("account.settings");
  const tAccount = useTranslations("account.common");
  const tTags = useTranslations("signup.profile.form.tags");
  const authSnapshot = useAuthSnapshot();
  const mode = useFoundationMode();
  const settingsApi = useAccountSettingsApi();
  const { signOut } = useAuthActions();
  const router = useRouter();
  const inputId = useId();
  const errorId = useId();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<KnownError | "generic" | null>(null);
  // Synchronous guard: a second click lands before the `busy` state update.
  const pendingRef = useRef(false);

  // Signed out after being signed in on this page, and not because this page just deleted the account: the session ended
  // (a delete confirmation hit a revoked session, say). Say so instead of showing the plain "sign in" gate.
  const [seenSignedIn, setSeenSignedIn] = useState(false);
  const [withdrawn, setWithdrawn] = useState(false);
  if (authSnapshot.status === "signed-in" && !seenSignedIn) setSeenSignedIn(true);

  if (authSnapshot.status === "signed-out") {
    return <SignedOutPanel message={seenSignedIn && !withdrawn ? tAccount("sessionExpired") : t("signedOutMessage")} />;
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
      setError(knownCode(caught, deleteErrors.codes) ?? deleteErrors.fallback);
      pendingRef.current = false;
      setBusy(false);
      return;
    }
    // The BE already revoked every session; signOut clears the cookie (POST /api/auth/logout) and the local state.
    setWithdrawn(true);
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
        <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-[160px_1fr]">
          <dt className="text-ink-muted">{t("nicknameLabel")}</dt>
          <dd className="font-semibold text-ink">{nickname}</dd>
          {user.bio ? (
            <>
              <dt className="text-ink-muted">{t("bioLabel")}</dt>
              <dd className="min-w-0 whitespace-pre-wrap break-words text-ink-secondary">{user.bio}</dd>
            </>
          ) : null}
          {user.tags && user.tags.length > 0 ? (
            <>
              <dt className="text-ink-muted">{t("tagsLabel")}</dt>
              <dd className="font-semibold text-ink">{user.tags.map((tag) => tTags(tag.toLowerCase())).join(", ")}</dd>
            </>
          ) : null}
          {user.walletAddress ? (
            <>
              <dt className="text-ink-muted">{t("walletLabel")}</dt>
              <dd className="break-all font-semibold text-ink">{user.walletAddress}</dd>
            </>
          ) : null}
        </dl>
        {editingProfile ? (
          <div className="mt-2 border-t border-border pt-4">
            <ProfileForm mode="edit" onSaved={() => setEditingProfile(false)} />
            <button className={`mt-3 ${secondaryButtonClass}`} onClick={() => setEditingProfile(false)} type="button">{t("cancelEdit")}</button>
          </div>
        ) : (
          <button className={`mt-5 ${secondaryButtonClass}`} onClick={() => setEditingProfile(true)} type="button">{t("editProfile")}</button>
        )}
      </section>

      <WalletSettings wallet={wallet} />

      <MyCohortApplications />

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
            // An IME (Korean/Japanese/Chinese nicknames) sends Enter to commit the composition: that must not delete the account.
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
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
