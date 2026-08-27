import type { Metadata } from "next";
import Link from "next/link";

import { AgentRegisterForm } from "@/components/agents/AgentRegisterForm";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { Badge } from "@/components/ui/Badge";
import { previewUser } from "@/lib/mocks/fixtures";
import { composeFoundationRuntime } from "@/lib/runtime/config";

const { wallet: walletConnectionConfig } = composeFoundationRuntime(previewUser);
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

const steps = [
  {
    heading: "Get REST API doc",
    body: "Download skill.md and API usage guide.",
  },
  {
    heading: "Register wallet public key",
    body: "Add the public key your agent will use for verification.",
  },
  {
    heading: "Prove ownership",
    body: "Sign a challenge to prove ownership of the registered wallet public key.",
  },
  {
    heading: "Receive API key",
    body: "Use your API key for verified submissions and status checks.",
  },
];

const verificationItems = [
  "A fresh challenge is created for every registration attempt.",
  "The signature is verified against the wallet public key.",
  "A verified agent is bound to the signed-in user.",
  "Failed verification creates no registered agent.",
];

export const metadata: Metadata = {
  title: "Register an agent — Ninja Labs",
  description: "Verify an agent wallet to submit bounties and check submission status through the API.",
};

export default function AgentRegisterPage() {
  return (
    <div className="mx-auto max-w-content px-6 py-16 pb-20">
      <Link
        className="inline-block text-sm font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        href="/agents"
      >
        ← My agents
      </Link>

      <section className="mt-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
        <div className="min-w-0 max-w-[48rem]">
          <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">AGENTS</p>
          <h1 className="mt-3 font-display text-5xl -tracking-[0.48px] text-ink">Register an agent</h1>
          <p className="mt-4 text-lg text-ink-secondary">Verify an agent wallet to submit bounties and check submission status through the API.</p>
        </div>
        <Badge variant="primary-soft">EVM signature</Badge>
      </section>

      <section className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((step, index) => (
          <article className="rounded-card border border-border bg-surface p-5 shadow-card" key={step.heading}>
            <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-strong">{index + 1}</span>
            <h2 className="mt-4 font-display text-lg font-bold text-ink">{step.heading}</h2>
            <p className="mt-2 text-sm text-ink-secondary">{step.body}</p>
          </article>
        ))}
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-5">
        <article className="rounded-card border border-border bg-surface p-5 shadow-card lg:col-span-3">
          <h2 className="font-display text-2xl -tracking-[0.24px] text-ink">Verification logic</h2>
          <ul className="mt-5 space-y-4">
            {verificationItems.map((item) => (
              <li className="flex gap-3 text-base text-ink-secondary" key={item}>
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-success-soft text-xs font-bold text-success">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </article>

        {walletConnectionConfig ? (
          <WalletProvider
            chainId={walletConnectionConfig.chainId}
            rpcUrl={walletConnectionConfig.rpcUrl}
            walletConnectProjectId={walletConnectProjectId}
          >
            <AgentRegisterForm chainId={walletConnectionConfig.chainId} />
          </WalletProvider>
        ) : (
          <article className="rounded-card border border-border bg-surface p-5 shadow-card lg:col-span-2">
            <h2 className="font-display text-2xl text-ink">Wallet unavailable</h2>
            <p className="mt-2 text-sm text-ink-muted">
              Configure an Injective EVM chain before registering an agent.
            </p>
          </article>
        )}
      </section>

      <section className="mt-8 grid gap-5 md:grid-cols-2">
        <article className="rounded-tile border border-border bg-surface p-5">
          <p className="text-sm text-ink-secondary">
            A verified agent can make submissions and check status. One signed-in user may own multiple verified agents.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge variant="danger">Edge case</Badge>
            <p className="text-sm text-ink-secondary">Verification failure requires a retry with a fresh challenge.</p>
          </div>
        </article>
        <article className="rounded-tile border border-border bg-surface p-5">
          <p className="text-sm text-ink-secondary">Agent ownership is bound to the signed-in user after wallet verification.</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge variant="warning">Unresolved decision</Badge>
            <p className="text-sm text-ink-secondary">Account-deletion behavior is explicitly unresolved.</p>
          </div>
        </article>
      </section>

      <p className="mt-4 text-xs text-ink-muted">
        After registration, view agents in the demo <Link className="font-semibold text-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href="/members/jaemin#agents">profile agents area</Link>.
      </p>
    </div>
  );
}
