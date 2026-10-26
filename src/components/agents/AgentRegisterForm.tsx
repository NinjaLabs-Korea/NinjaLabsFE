"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAccountQuery } from "@/components/account/useAccountQuery";
import { ApiKeyReveal } from "@/components/agents/ApiKeyReveal";
import {
  useAuthSnapshot,
  useAccountApi,
  useAgentApi,
} from "@/components/auth/FoundationProvider";
import { isSameWalletAddress } from "@/lib/injective-address";
import { Link } from "@/i18n/navigation";
import { shortWalletAddress, useWalletConnection } from "@/components/wallet/useWalletConnection";
import type { AgentVerification } from "@/lib/contracts/api";
import { ERROR_COPY, errorCopyKey } from "@/lib/api/error-copy";
import { formatUtcDateTime } from "@/lib/format";
import { validationFieldsFromError } from "@/lib/api/validation";
import {
  AGENT_DESCRIPTION_MAX,
  AGENT_NAME_MAX,
  agentErrorsFromValidationFields,
  hasVisibleText,
  validateAgentRegisterForm,
  type AgentRegisterErrors,
} from "@/lib/agent-register-form";
import {
  maskWalletAddress,
  onboardingErrorDetails,
  onboardingLog,
} from "@/lib/onboarding-log";

type AgentRegisterFormProps = { chainId: number };
type SubmissionState = "idle" | "registering" | "signing" | "verifying";

export function AgentRegisterForm({ chainId }: AgentRegisterFormProps) {
  const t = useTranslations("agents.form");
  const tRegisterErrors = useTranslations(ERROR_COPY.agentRegister.messages);
  const tWallet = useTranslations("common.wallet");
  // UTC-pinned via src/i18n/request.ts, like AgentsView's key expiry.
  const format = useFormatter();
  const auth = useAuthSnapshot();
  const accountApi = useAccountApi();
  const agentApi = useAgentApi();
  const { data: agents, loading: agentsLoading, refresh: refreshAgents } = useAccountQuery(accountApi.getAgents);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submissionState, setSubmissionState] = useState<SubmissionState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // 필드 검증 에러 (BE RegisterAgentDto 한도의 거울, `lib/agent-register-form.ts`). 요청 실패 문구(errorMessage)와는 따로 표시한다.
  const [fieldErrors, setFieldErrors] = useState<AgentRegisterErrors>({});
  const [verification, setVerification] = useState<AgentVerification | null>(null);
  // The one-time key belongs to the session that received it: signing out (or switching account) on this page must drop
  // it from state and the DOM, not leave it on screen for the next person at the machine.
  const sessionUserId = auth.status === "signed-in" ? auth.user.id : null;
  const [verificationOwner, setVerificationOwner] = useState(sessionUserId);
  // ...and a key that arrives after the session changed (verify still in flight) must never be shown to the new session.
  const sessionUserIdRef = useRef(sessionUserId);
  const inFlightRef = useRef(false);
  useEffect(() => {
    sessionUserIdRef.current = sessionUserId;
  }, [sessionUserId]);
  if (verificationOwner !== sessionUserId) {
    setVerificationOwner(sessionUserId);
    setVerification(null);
  }
  const {
    hasInjectedWallet,
    address,
    isConnected,
    isWrongNetwork,
    connector,
    connect,
    isConnecting,
    disconnect,
    signMessageAsync,
    canSwitch,
    switchToTargetChain,
    isSwitching,
    switchError,
  } = useWalletConnection(chainId);
  const isBusy = submissionState !== "idle";
  // The BE stores the owner's wallet as inj1..., the injected wallet reports 0x...: compare the decoded bytes.
  const ownerWallet = auth.user?.walletAddress;
  const isOwnerWallet = Boolean(address && ownerWallet && isSameWalletAddress(ownerWallet, address));
  // A REVOKED agent no longer claims its wallet: registering it again replaces it with a fresh pending agent (the BE soft-deletes the old row).
  const existingAgent = address
    ? agents?.find((agent) => agent.status !== "REVOKED" && agent.walletAddress.toLowerCase() === address.toLowerCase())
    : undefined;
  const isPendingAgent = existingAgent?.status === "PENDING_VERIFICATION";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Synchronous guard: several submit events can land in one tick, before `submissionState` (React state) is set and the
    // button re-renders disabled. Each would otherwise register an agent, ask the wallet for a signature and verify.
    if (inFlightRef.current) return;
    if (
      auth.status !== "signed-in" ||
      !address ||
      isWrongNetwork ||
      isOwnerWallet ||
      existingAgent?.verified ||
      !hasVisibleText(name)
    ) {
      return;
    }

    const nextErrors = validateAgentRegisterForm({ name, description });
    if (nextErrors.name || nextErrors.description) {
      setFieldErrors(nextErrors);
      setErrorMessage(t("errorInvalid"));
      return;
    }

    inFlightRef.current = true;
    const agentAddress = address;
    const requestingUserId = sessionUserId;
    setErrorMessage(null);
    setFieldErrors({});
    setVerification(null);
    try {
      setSubmissionState("registering");
      onboardingLog("agent.registration.started", {
        wallet: maskWalletAddress(agentAddress),
      });
      const registration = await agentApi.registerAgent({
        name: name.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        walletAddress: agentAddress,
      });

      setSubmissionState("signing");
      onboardingLog("agent.signature.requested", {
        wallet: maskWalletAddress(agentAddress),
        signatureType: "EIP191",
        agentId: registration.agentId,
      });
      const signature = await signMessageAsync({
        account: agentAddress,
        message: registration.verificationMessage,
      });

      setSubmissionState("verifying");
      const verified = await agentApi.verifyAgent(registration.agentId, signature);
      if (sessionUserIdRef.current !== requestingUserId) return;
      setVerification(verified);
      // Re-read /agents/me so the "pending verification" banner (derived from the list) disappears with the new ACTIVE row.
      refreshAgents();
      onboardingLog("agent.registration.succeeded", {
        wallet: maskWalletAddress(agentAddress),
        agentId: verified.agentId,
      });
    } catch (caught) {
      onboardingLog("agent.registration.failed", {
        wallet: address ? maskWalletAddress(address) : null,
        ...onboardingErrorDetails(caught),
      });
      // BE 400 VALIDATION_FAILED: message[]가 가리키는 필드를 인라인 에러로 돌려준다.
      const rejected = agentErrorsFromValidationFields(validationFieldsFromError(caught), { name, description });
      if (rejected.name || rejected.description) {
        setFieldErrors(rejected);
        setErrorMessage(t("errorInvalid"));
      } else {
        const key = errorCopyKey(caught, ERROR_COPY.agentRegister);
        // The BE answers one code for "your own agent holds this wallet" and "another account's pending agent holds it".
        // "View it in My agents" only helps in the first case: tell the user when /agents/me (already loaded) has no such agent.
        const heldByOthers = key === "AGENT_KEY_OR_WALLET_ALREADY_REGISTERED" && Boolean(agents) && !agents?.some((agent) => agent.walletAddress.toLowerCase() === agentAddress.toLowerCase());
        setErrorMessage(tRegisterErrors(heldByOthers ? "walletHeldByOther" : key));
      }
    } finally {
      inFlightRef.current = false;
      setSubmissionState("idle");
    }
  }

  const fieldErrorText = (field: keyof AgentRegisterErrors) => {
    const reason = fieldErrors[field];
    if (!reason) return null;
    const key = `errors.${field}${reason.charAt(0).toUpperCase()}${reason.slice(1)}`;
    return t(key, { max: field === "name" ? AGENT_NAME_MAX : AGENT_DESCRIPTION_MAX });
  };
  const nameError = fieldErrorText("name");
  const descriptionError = fieldErrorText("description");

  const buttonLabel =
    submissionState === "registering"
      ? t("registering")
      : submissionState === "signing"
        ? t("signing")
        : submissionState === "verifying"
          ? t("verifying")
          : t("submit");

  return (
    <form
      className="rounded-card border border-border bg-surface p-[21px] shadow-card lg:col-span-2"
      onSubmit={(event) => void submit(event)}
    >
      <h2 className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{t("eyebrow")}</h2>
      <p className="mt-2 text-sm text-ink-muted">
        {t("intro")}
      </p>

      <label className="mt-5 block text-sm font-semibold text-ink" htmlFor="agent-name">
        {t("nameLabel")}
      </label>
      <input
        aria-describedby={nameError ? "agent-name-error" : undefined}
        aria-invalid={nameError ? true : undefined}
        className="mt-2 h-[46px] w-full rounded-control border border-border bg-surface px-3 text-sm text-ink placeholder:text-ink-placeholder aria-[invalid]:border-danger"
        disabled={isBusy || Boolean(verification)}
        id="agent-name"
        maxLength={AGENT_NAME_MAX}
        onChange={(event) => {
          setName(event.target.value);
          setFieldErrors((current) => ({ ...current, name: undefined }));
        }}
        placeholder={t("namePlaceholder")}
        required
        type="text"
        value={name}
      />
      {nameError ? <p className="mt-1 text-xs text-danger" id="agent-name-error" role="alert">{nameError}</p> : null}

      <label className="mt-4 block text-sm font-semibold text-ink" htmlFor="agent-description">
        {t("descriptionLabel")} <span className="font-normal text-ink-muted">{t("optional")}</span>
      </label>
      <textarea
        aria-describedby={descriptionError ? "agent-description-error agent-description-counter" : "agent-description-counter"}
        aria-invalid={descriptionError ? true : undefined}
        className="mt-2 min-h-24 w-full rounded-control border border-border bg-surface p-3 text-sm text-ink placeholder:text-ink-placeholder aria-[invalid]:border-danger"
        disabled={isBusy || Boolean(verification)}
        id="agent-description"
        maxLength={AGENT_DESCRIPTION_MAX}
        onChange={(event) => {
          setDescription(event.target.value);
          setFieldErrors((current) => ({ ...current, description: undefined }));
        }}
        placeholder={t("descriptionPlaceholder")}
        value={description}
      />
      <p className="mt-1 text-right text-xs text-ink-muted" id="agent-description-counter">
        {t("counter", { count: description.length, max: AGENT_DESCRIPTION_MAX })}
      </p>
      {descriptionError ? <p className="mt-1 text-xs text-danger" id="agent-description-error" role="alert">{descriptionError}</p> : null}

      <div className="mt-4 rounded-tile border border-border bg-surface-subtle p-4">
        <p className="text-sm font-semibold text-ink">{t("walletLabel")}</p>
        {address ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <code className="text-sm text-ink-secondary">{shortWalletAddress(address)}</code>
            <button
              className="text-xs font-semibold text-primary-strong"
              disabled={isBusy}
              onClick={() => disconnect()}
              type="button"
            >
              {t("disconnect")}
            </button>
          </div>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">{t("noWallet")}</p>
        )}
      </div>

      {auth.status === "signed-out" ? (
        <p className="mt-3 text-sm text-danger" role="alert">{t("signInRequired")}</p>
      ) : null}
      {isOwnerWallet ? (
        <p className="mt-3 text-sm text-danger" role="alert">
          {t("ownerWallet")}
        </p>
      ) : null}
      {existingAgent?.verified && !verification ? (
        <div className="mt-3 rounded-tile border border-success-soft bg-success-soft p-3" role="status">
          <p className="text-sm font-semibold text-success">
            {t("alreadyRegistered", { name: existingAgent.name })}
          </p>
          <Link className="mt-2 inline-block text-xs font-semibold text-primary-strong" href="/agents">
            {t("viewAgents")}
          </Link>
        </div>
      ) : null}
      {isPendingAgent ? (
        <p className="mt-3 text-sm text-warning" role="status">
          {t("pending")}
        </p>
      ) : null}
      {errorMessage ? <p className="mt-3 text-sm text-danger" role="alert">{errorMessage}</p> : null}
      {isWrongNetwork && switchError ? (
        <p className="mt-3 text-sm text-danger" role="alert">
          {tWallet(switchError === "rejected" ? "switchRejected" : "switchFailed")}
        </p>
      ) : null}
      {isWrongNetwork && !canSwitch ? (
        <p className="mt-3 text-sm text-warning" role="status">
          {tWallet("switchUnavailable")}
        </p>
      ) : null}

      {!isConnected ? (
        <button
          className="mt-5 h-[46px] w-full rounded-control bg-primary px-5 text-sm font-semibold text-on-inverse disabled:opacity-60"
          disabled={!hasInjectedWallet || !connector || isConnecting}
          onClick={connect}
          type="button"
        >
          {isConnecting ? t("connecting") : t("connect")}
        </button>
      ) : isWrongNetwork ? (
        <button
          className="mt-5 h-[46px] w-full rounded-control bg-warning-soft px-5 text-sm font-semibold text-warning disabled:opacity-60"
          disabled={isSwitching || !canSwitch}
          onClick={switchToTargetChain}
          type="button"
        >
          {isSwitching ? t("switching") : t("switchNetwork")}
        </button>
      ) : (
        <button
          className="mt-5 h-[46px] w-full rounded-control bg-primary px-5 text-sm font-semibold text-on-inverse disabled:opacity-60"
          disabled={
            auth.status !== "signed-in" ||
            agentsLoading ||
            isBusy ||
            isOwnerWallet ||
            existingAgent?.verified ||
            !hasVisibleText(name) ||
            Boolean(verification)
          }
          type="submit"
        >
          {buttonLabel}
        </button>
      )}

      {verification ? (
        <ApiKeyReveal
          apiKey={verification.apiKey}
          className="mt-5"
          copy={t("copyKey")}
          expiresLabel={t("expires", { date: formatUtcDateTime(format, verification.expiresAt) })}
          title={t("verified")}
        />
      ) : null}
    </form>
  );
}
