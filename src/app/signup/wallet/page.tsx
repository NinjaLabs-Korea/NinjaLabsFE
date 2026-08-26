import type { Metadata } from "next";
import Link from "next/link";

import { WalletConnectButton } from "@/components/wallet/WalletConnectButton";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { Badge } from "@/components/ui/Badge";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { signup } from "@/lib/signup";
import { previewUser } from "@/lib/mocks/fixtures";
import { composeFoundationRuntime } from "@/lib/runtime/config";

const { foundationConfig, wallet: walletConnectionConfig } = composeFoundationRuntime(previewUser);
const isApiMode = foundationConfig.mode === "api";
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

export const metadata: Metadata = {
  title: "Connect wallet — Ninja Labs",
  description: isApiMode
    ? "Connect and verify an Injective wallet."
    : "Preview an Injective wallet connection.",
};

export default function SignupWalletPage() {
  return (
    <section className="mx-auto max-w-content px-6 py-16 pb-20">
      <div className="mx-auto max-w-[1024px]">
        <div className="flex justify-end">
          <Badge variant="danger">
            {walletConnectionConfig
              ? isApiMode ? "SIGN-UP FLOW" : "SIGN-UP FLOW (wallet preview)"
              : "WALLET UNAVAILABLE"}
          </Badge>
        </div>
        <div className="mt-8">
          <StepIndicator current={2} />
        </div>
        <div className="mt-6 grid gap-5 lg:grid-cols-5">
          <article className="rounded-card border border-border bg-surface p-5 shadow-card sm:p-[21px] lg:col-span-3">
            <h1 className="font-display text-4xl -tracking-[0.36px] text-ink">
              {signup.wallet.title}
            </h1>
            <p className="mt-3 text-base text-ink-muted">
              {isApiMode
                ? "Connect your Injective EVM wallet, then sign a gas-free message to prove ownership."
                : "Connect an Injective EVM wallet in this local session preview."}
            </p>
            <div className="mt-5 [&_button]:w-full">
              {walletConnectionConfig ? (
                <WalletProvider
                  chainId={walletConnectionConfig.chainId}
                  rpcUrl={walletConnectionConfig.rpcUrl}
                  walletConnectProjectId={walletConnectProjectId}
                >
                  <WalletConnectButton chainId={walletConnectionConfig.chainId} />
                </WalletProvider>
              ) : (
                <div className="flex flex-col items-start gap-2">
                  <button
                    className="w-full rounded-control border border-border bg-surface px-5 py-3 text-base font-semibold text-ink-secondary disabled:cursor-not-allowed disabled:opacity-60"
                    disabled
                    type="button"
                  >
                    Wallet unavailable
                  </button>
                  <p className="text-xs text-ink-muted" role="status">
                    Wallet connection is unavailable until a supported Injective EVM chain is
                    configured.
                  </p>
                </div>
              )}
            </div>
            <div className="mt-5 rounded-tile border border-border bg-primary-soft p-4">
              <Badge variant="primary-soft">
                {isApiMode ? "Gas-free verification" : "Connection-only preview"}
              </Badge>
              <p className="mt-2 text-sm text-ink-notice">
                {isApiMode
                  ? "The signature does not submit a transaction. A verified wallet is linked to your account and queues your Ninja NFT mint."
                  : "Mock mode does not sign, link an account, or call the backend."}
              </p>
            </div>
            <Link
              className="mt-5 block w-full rounded-control border border-primary-outline px-5 py-3 text-center text-sm font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              href="/signup/profile"
            >
              Connect later
            </Link>
            <p className="mt-4 text-sm text-ink-muted">
              Wallet verification is optional. You can continue now and connect one later.
            </p>
          </article>
          <aside className="rounded-card border border-border bg-surface p-5 shadow-card sm:p-[21px] lg:col-span-2">
            <h2 className="font-display text-2xl -tracking-[0.24px] text-ink">
              What happens
            </h2>
            <dl className="mt-5 space-y-4">
              {[
                ["Connection", "MetaMask or another EVM wallet"],
                ["Signing", "EIP-191 personal_sign ownership proof"],
                ["Gas", "No transaction and no gas fee"],
                ["Account linking", "Verified wallet saved to your account"],
                ["NFT", "Parent Ninja NFT mint is queued"],
              ].map(([term, detail]) => (
                <div key={term}>
                  <dt className="text-sm font-semibold text-ink">{term}</dt>
                  <dd className="mt-1 text-sm text-ink-muted">{detail}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </div>
    </section>
  );
}
