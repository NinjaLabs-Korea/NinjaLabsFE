"use client";

import { useLocale, useTranslations } from "next-intl";
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
import { ERROR_COPY, knownCode } from "@/lib/api/error-copy";
import type { ClientUser } from "@/lib/contracts/auth";
import { stashFlash } from "@/lib/flash";
import { hardNavigate } from "@/lib/hard-navigate";
import { normalizeNickname } from "@/lib/nickname";
import type { WalletConfig } from "@/lib/runtime/config";
import { PageLoading } from "@/components/ui/PageLoading";

const focusClass =
  "hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const secondaryButtonClass = `rounded-control border border-primary-outline px-4 py-2 max-sm:py-2.5 text-sm font-semibold text-primary-strong ${focusClass}`;
const dangerButtonClass = `rounded-control border border-danger-soft bg-danger-soft px-4 py-2 max-sm:py-2.5 text-sm font-semibold text-danger disabled:opacity-60 ${focusClass}`;

/** Shared by the loading and signed-out branches so the footer stays put between them. */
const PAGE_MIN_HEIGHT = "min-h-dvh";

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
  const locale = useLocale();
  const inputId = useId();
  const errorId = useId();
  const [dialogOpen, setDialogOpen] = useState(false);
  // The id of the user the profile editor was opened for (null: closed). The editor shows only while it matches the
  // signed-in user, so another tab switching accounts closes it instead of saving A's form into B.
  const [editingProfileFor, setEditingProfileFor] = useState<string | null>(null);
  // The last signed-in user: while the profile editor is open and the session ends from outside, the page keeps showing it
  // (with the typed values) instead of swapping in the sign-in prompt.
  const [lastUser, setLastUser] = useState<ClientUser | null>(null);
  if (authSnapshot.status === "signed-in" && lastUser !== authSnapshot.user) setLastUser(authSnapshot.user);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<KnownError | "generic" | null>(null);
  // Synchronous guard: a second click lands before the `busy` state update.
  const pendingRef = useRef(false);

  // Only a session ended from outside (refresh rejected, another tab) says "expired"; the user's own Sign out or this
  // page's account deletion shows the plain "sign in" gate.
  const heldForEdit = authSnapshot.status === "signed-out" && authSnapshot.reason === "session-ended" && editingProfileFor !== null && lastUser !== null;
  if (authSnapshot.status === "signed-out" && !heldForEdit) {
    // Same min-h-dvh wrapper as the loading placeholder below: loading -> signed-out must not shorten the page under the footer.
    return (
      <div className={PAGE_MIN_HEIGHT}>
        <SignedOutPanel message={authSnapshot.reason === "session-ended" ? tAccount("sessionExpired") : t("signedOutMessage")} returnTo="/account" />
      </div>
    );
  }

  if (authSnapshot.status === "loading") {
    // min-h-dvh: the signed-in settings are several screens tall, so a short placeholder would let the footer jump.
    return <div className={PAGE_MIN_HEIGHT}><PageLoading label={tAccount("loading")} /></div>;
  }

  const user = authSnapshot.status === "signed-in" ? authSnapshot.user : lastUser;
  if (!user) return null;
  const editingProfile = editingProfileFor === user.id;
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
    try {
      await signOut();
    } finally {
      // Written after signOut and without the live event: the next step is a full page load, and the mounted
      // FlashToast would take (and lose) an event-delivered flash before the reload.
      stashFlash("accountDeleted");
      hardNavigate(`/${locale}`);
    }
  };

  return (
    <div className="space-y-8">
      <section aria-labelledby={`${inputId}-profile`} className="rounded-card border border-border bg-surface p-6 shadow-card">
        <h2 className="font-display text-xl font-bold text-ink" id={`${inputId}-profile`}>{t("profileHeading")}</h2>
        <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-[160px_1fr]">
          <dt className="text-ink-muted">{t("nicknameLabel")}</dt>
          <dd className="min-w-0 font-semibold text-ink [overflow-wrap:anywhere]">{nickname}</dd>
          {user.bio ? (
            <>
              <dt className="text-ink-muted">{t("bioLabel")}</dt>
              <dd className="min-w-0 whitespace-pre-wrap break-words text-ink-secondary [overflow-wrap:anywhere]">{user.bio}</dd>
            </>
          ) : null}
          {user.tags && user.tags.length > 0 ? (
            <>
              <dt className="text-ink-muted">{t("tagsLabel")}</dt>
              <dd className="min-w-0 font-semibold text-ink">{user.tags.map((tag) => tTags(tag.toLowerCase())).join(", ")}</dd>
            </>
          ) : null}
          {user.walletAddress ? (
            <>
              <dt className="text-ink-muted">{t("walletLabel")}</dt>
              <dd className="min-w-0 break-all font-semibold text-ink [overflow-wrap:anywhere]">{user.walletAddress}</dd>
            </>
          ) : null}
        </dl>
        {editingProfile ? (
          <div className="mt-2 border-t border-border pt-4">
            <ProfileForm key={user.id} mode="edit" onSaved={() => setEditingProfileFor(null)} />
            <button className={`mt-3 ${secondaryButtonClass}`} onClick={() => setEditingProfileFor(null)} type="button">{t("cancelEdit")}</button>
          </div>
        ) : (
          <button className={`mt-5 ${secondaryButtonClass}`} onClick={() => setEditingProfileFor(user.id)} type="button">{t("editProfile")}</button>
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
        confirmDisabled={!matches}
        pending={busy}
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
