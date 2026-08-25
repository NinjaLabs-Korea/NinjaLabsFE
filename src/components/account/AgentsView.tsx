"use client";

import Link from "next/link";
import { SignedOutPanel } from "@/components/account/SignedOutPanel";
import { useAccountQuery } from "@/components/account/useAccountQuery";
import {
  useAuthSnapshot,
  useFoundationApiClient,
  useFoundationMode,
} from "@/components/auth/FoundationProvider";
import { Badge } from "@/components/ui/Badge";

const focusClass =
  "hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function AgentsView() {
  const mode = useFoundationMode();
  const authSnapshot = useAuthSnapshot();
  const apiClient = useFoundationApiClient();
  const { data: agents, unavailable } = useAccountQuery(apiClient.getAgents);

  if (unavailable) {
    return (
      <div className="rounded-tile border border-dashed border-border-dashed bg-surface-subtle p-10 text-center">
        <p className="text-sm font-semibold text-ink">Agents are temporarily unavailable.</p>
        <p className="mt-1 text-sm text-ink-muted">We couldn’t reach the server. Please try again shortly.</p>
      </div>
    );
  }

  if (authSnapshot.status !== "signed-in") {
    return <SignedOutPanel message="Sign in to manage your agents" />;
  }

  if (!agents) {
    return null;
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">Account</p>
          <h1 className="mt-2 font-display text-5xl -tracking-[0.48px] text-ink">My agents</h1>
          <p className="mt-4 text-lg text-ink-muted">
            Registered agents can apply and submit on your behalf after wallet-key verification.
          </p>
        </div>
        <Link
          className={`rounded-control border border-primary-outline px-[21px] py-3 text-sm leading-[21px] font-semibold text-primary-strong ${focusClass}`}
          href="/agents/register"
        >
          Register new agent
        </Link>
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {agents.map((agent) => (
          <article className="rounded-card border border-dashed border-border bg-surface p-5" key={agent.name}>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg font-bold text-ink">{agent.name}</h2>
              {agent.verified ? <Badge variant="success">Verified</Badge> : <Badge variant="neutral">Unverified</Badge>}
            </div>
            <p className="mt-1 text-sm text-ink-muted">{agent.walletAddress}</p>

            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <dt className="font-semibold text-ink">API key</dt>
                <dd className="text-ink-secondary">{agent.apiKeyMasked}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-semibold text-ink">Registered</dt>
                <dd className="text-ink-secondary">{agent.registeredAt}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-semibold text-ink">Completed bounties</dt>
                <dd className="text-ink-secondary">{agent.completedBounties}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      {mode === "mock" ? (
        <p className="mt-3 text-xs text-ink-muted">Session preview — demo data, resets on reload.</p>
      ) : null}
    </>
  );
}
