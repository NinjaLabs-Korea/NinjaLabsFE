"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSignMessage,
  useSwitchChain,
} from "wagmi";
import { useAccountQuery } from "@/components/account/useAccountQuery";
import {
  useAuthSnapshot,
  useAccountApi,
  useAgentApi,
} from "@/components/auth/FoundationProvider";
import { Link } from "@/i18n/navigation";
import type { AgentVerification } from "@/lib/contracts/api";
import { ApiHttpError } from "@/lib/api/http";
import {
  maskWalletAddress,
  onboardingErrorDetails,
  onboardingLog,
} from "@/lib/onboarding-log";

type AgentRegisterFormProps = { chainId: number };
type SubmissionState = "idle" | "registering" | "signing" | "verifying";

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function AgentRegisterForm({ chainId }: AgentRegisterFormProps) {
  const t = useTranslations("agents.form");
  const locale = useLocale();
  const auth = useAuthSnapshot();
  const accountApi = useAccountApi();
  const agentApi = useAgentApi();
  const { data: agents, loading: agentsLoading } = useAccountQuery(accountApi.getAgents);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submissionState, setSubmissionState] = useState<SubmissionState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verification, setVerification] = useState<AgentVerification | null>(null);
  const hasInjectedWallet = useSyncExternalStore(
    () => () => undefined,
    () => "ethereum" in window,
    () => false,
  );
  const { address, chainId: connectedChainId, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const connector = connectors.find((candidate) => candidate.type === "injected");
  const isBusy = submissionState !== "idle";
  const isWrongNetwork = isConnected && connectedChainId !== chainId;
  const ownerWallet = auth.user?.walletAddress?.toLowerCase();
  const isOwnerWallet = Boolean(address && ownerWallet === address.toLowerCase());
  const existingAgent = address
    ? agents?.find((agent) => agent.walletAddress.toLowerCase() === address.toLowerCase())
    : undefined;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      auth.status !== "signed-in" ||
      !address ||
      isWrongNetwork ||
      isOwnerWallet ||
      existingAgent?.verified ||
      !name.trim()
    ) {
      return;
    }

    const agentAddress = address;
    setErrorMessage(null);
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
      setVerification(verified);
      onboardingLog("agent.registration.succeeded", {
        wallet: maskWalletAddress(agentAddress),
        agentId: verified.agentId,
      });
    } catch (caught) {
      onboardingLog("agent.registration.failed", {
        wallet: address ? maskWalletAddress(address) : null,
        ...onboardingErrorDetails(caught),
      });
      setErrorMessage(
        caught instanceof ApiHttpError && caught.code === "AGENT_KEY_OR_WALLET_ALREADY_REGISTERED"
          ? t("errorAlreadyRegistered")
          : t("errorFailed"),
      );
    } finally {
      setSubmissionState("idle");
    }
  }

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
      className="rounded-card border border-border bg-surface p-5 shadow-card lg:col-span-2"
      onSubmit={(event) => void submit(event)}
    >
      <h2 className="font-display text-2xl -tracking-[0.24px] text-ink">{t("heading")}</h2>
      <p className="mt-2 text-sm text-ink-muted">
        {t("intro")}
      </p>

      <label className="mt-5 block text-sm font-semibold text-ink" htmlFor="agent-name">
        {t("nameLabel")}
      </label>
      <input
        className="mt-2 h-[46px] w-full rounded-control border border-border bg-surface px-3 text-sm text-ink placeholder:text-ink-placeholder"
        disabled={isBusy || Boolean(verification)}
        id="agent-name"
        maxLength={100}
        onChange={(event) => setName(event.target.value)}
        placeholder={t("namePlaceholder")}
        required
        type="text"
        value={name}
      />

      <label className="mt-4 block text-sm font-semibold text-ink" htmlFor="agent-description">
        {t("descriptionLabel")} <span className="font-normal text-ink-muted">{t("optional")}</span>
      </label>
      <textarea
        className="mt-2 min-h-24 w-full rounded-control border border-border bg-surface p-3 text-sm text-ink placeholder:text-ink-placeholder"
        disabled={isBusy || Boolean(verification)}
        id="agent-description"
        onChange={(event) => setDescription(event.target.value)}
        placeholder={t("descriptionPlaceholder")}
        value={description}
      />

      <div className="mt-4 rounded-tile border border-border bg-surface-subtle p-4">
        <p className="text-sm font-semibold text-ink">{t("walletLabel")}</p>
        {address ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <code className="text-sm text-ink-secondary">{shortAddress(address)}</code>
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

      {auth.status !== "signed-in" ? (
        <p className="mt-3 text-sm text-danger" role="alert">{t("signInRequired")}</p>
      ) : null}
      {isOwnerWallet ? (
        <p className="mt-3 text-sm text-danger" role="alert">
          {t("ownerWallet")}
        </p>
      ) : null}
      {existingAgent?.verified ? (
        <div className="mt-3 rounded-tile border border-success-soft bg-success-soft p-3" role="status">
          <p className="text-sm font-semibold text-success">
            {t("alreadyRegistered", { name: existingAgent.name })}
          </p>
          <Link className="mt-2 inline-block text-xs font-semibold text-primary-strong" href="/agents">
            {t("viewAgents")}
          </Link>
        </div>
      ) : null}
      {existingAgent && !existingAgent.verified ? (
        <p className="mt-3 text-sm text-warning" role="status">
          {t("pending")}
        </p>
      ) : null}
      {errorMessage ? <p className="mt-3 text-sm text-danger" role="alert">{errorMessage}</p> : null}

      {!isConnected ? (
        <button
          className="mt-5 h-[46px] w-full rounded-control bg-primary px-5 text-sm font-semibold text-on-inverse disabled:opacity-60"
          disabled={!hasInjectedWallet || !connector || isConnecting}
          onClick={() => connector && connect({ connector })}
          type="button"
        >
          {isConnecting ? t("connecting") : t("connect")}
        </button>
      ) : isWrongNetwork ? (
        <button
          className="mt-5 h-[46px] w-full rounded-control bg-warning-soft px-5 text-sm font-semibold text-warning disabled:opacity-60"
          disabled={isSwitching}
          onClick={() => switchChain({ chainId })}
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
            !name.trim() ||
            Boolean(verification)
          }
          type="submit"
        >
          {buttonLabel}
        </button>
      )}

      {verification ? (
        <div className="mt-5 rounded-tile border border-success-soft bg-success-soft p-4" role="status">
          <p className="text-sm font-semibold text-success">{t("verified")}</p>
          <p className="mt-2 text-xs text-ink-secondary">
            {t("copyKey")}
          </p>
          <code className="mt-2 block break-all rounded-control bg-surface p-3 text-xs text-ink">
            {verification.apiKey}
          </code>
          <p className="mt-2 text-xs text-ink-muted">
            {t("expires", { date: new Date(verification.expiresAt).toLocaleString(locale) })}
          </p>
        </div>
      ) : null}
    </form>
  );
}
