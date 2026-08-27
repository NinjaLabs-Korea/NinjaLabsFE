"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSignMessage,
  useSwitchChain,
} from "wagmi";
import {
  useAuthSnapshot,
  useFoundationApiClient,
} from "@/components/auth/FoundationProvider";
import type { AgentVerification } from "@/lib/contracts/api";
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
  const auth = useAuthSnapshot();
  const apiClient = useFoundationApiClient();
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (auth.status !== "signed-in" || !address || isWrongNetwork || isOwnerWallet || !name.trim()) {
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
      const registration = await apiClient.registerAgent({
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
      const verified = await apiClient.verifyAgent(registration.agentId, signature);
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
      setErrorMessage("Agent registration failed. Check the wallet signature and try again.");
    } finally {
      setSubmissionState("idle");
    }
  }

  const buttonLabel =
    submissionState === "registering"
      ? "Creating challenge…"
      : submissionState === "signing"
        ? "Waiting for signature…"
        : submissionState === "verifying"
          ? "Verifying agent…"
          : "Sign & Register";

  return (
    <form
      className="rounded-card border border-border bg-surface p-5 shadow-card lg:col-span-2"
      onSubmit={(event) => void submit(event)}
    >
      <h2 className="font-display text-2xl -tracking-[0.24px] text-ink">Registration form</h2>
      <p className="mt-2 text-sm text-ink-muted">
        Connect a separate MetaMask account used only by this agent. Do not reuse your personal
        onboarding wallet.
      </p>

      <label className="mt-5 block text-sm font-semibold text-ink" htmlFor="agent-name">
        Agent name
      </label>
      <input
        className="mt-2 h-[46px] w-full rounded-control border border-border bg-surface px-3 text-sm text-ink placeholder:text-ink-placeholder"
        disabled={isBusy || Boolean(verification)}
        id="agent-name"
        maxLength={100}
        onChange={(event) => setName(event.target.value)}
        placeholder="market-scout-agent"
        required
        type="text"
        value={name}
      />

      <label className="mt-4 block text-sm font-semibold text-ink" htmlFor="agent-description">
        Description <span className="font-normal text-ink-muted">(optional)</span>
      </label>
      <textarea
        className="mt-2 min-h-24 w-full rounded-control border border-border bg-surface p-3 text-sm text-ink placeholder:text-ink-placeholder"
        disabled={isBusy || Boolean(verification)}
        id="agent-description"
        onChange={(event) => setDescription(event.target.value)}
        placeholder="What this agent does"
        value={description}
      />

      <div className="mt-4 rounded-tile border border-border bg-surface-subtle p-4">
        <p className="text-sm font-semibold text-ink">Agent wallet</p>
        {address ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <code className="text-sm text-ink-secondary">{shortAddress(address)}</code>
            <button
              className="text-xs font-semibold text-primary-strong"
              disabled={isBusy}
              onClick={() => disconnect()}
              type="button"
            >
              Disconnect / switch
            </button>
          </div>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">No agent wallet connected.</p>
        )}
      </div>

      {auth.status !== "signed-in" ? (
        <p className="mt-3 text-sm text-danger" role="alert">Sign in before registering an agent.</p>
      ) : null}
      {isOwnerWallet ? (
        <p className="mt-3 text-sm text-danger" role="alert">
          This is your personal onboarding wallet. Switch MetaMask to a dedicated agent account.
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
          {isConnecting ? "Connecting…" : "Connect agent MetaMask"}
        </button>
      ) : isWrongNetwork ? (
        <button
          className="mt-5 h-[46px] w-full rounded-control bg-warning-soft px-5 text-sm font-semibold text-warning disabled:opacity-60"
          disabled={isSwitching}
          onClick={() => switchChain({ chainId })}
          type="button"
        >
          {isSwitching ? "Switching…" : "Switch to Injective EVM"}
        </button>
      ) : (
        <button
          className="mt-5 h-[46px] w-full rounded-control bg-primary px-5 text-sm font-semibold text-on-inverse disabled:opacity-60"
          disabled={
            auth.status !== "signed-in" || isBusy || isOwnerWallet || !name.trim() || Boolean(verification)
          }
          type="submit"
        >
          {buttonLabel}
        </button>
      )}

      {verification ? (
        <div className="mt-5 rounded-tile border border-success-soft bg-success-soft p-4" role="status">
          <p className="text-sm font-semibold text-success">Agent verified</p>
          <p className="mt-2 text-xs text-ink-secondary">
            Copy this API key now. It will not be shown again.
          </p>
          <code className="mt-2 block break-all rounded-control bg-surface p-3 text-xs text-ink">
            {verification.apiKey}
          </code>
          <p className="mt-2 text-xs text-ink-muted">
            Expires {new Date(verification.expiresAt).toLocaleString()}
          </p>
        </div>
      ) : null}
    </form>
  );
}
