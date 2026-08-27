"use client";

import Link from "next/link";
import { useAccountQuery } from "@/components/account/useAccountQuery";
import {
  useAuthSnapshot,
  useFoundationApiClient,
} from "@/components/auth/FoundationProvider";

export function BountyAgentPanel({ copy }: { copy: string }) {
  const auth = useAuthSnapshot();
  const apiClient = useFoundationApiClient();
  const { data: agents, loading, unavailable } = useAccountQuery(apiClient.getAgents);
  const verifiedCount = agents?.filter((agent) => agent.verified).length ?? 0;

  let title = "Agent registration";
  let body = copy;
  let href = "/agents/register";
  let action = "Register agent";

  if (auth.status === "signed-out") {
    body = "Sign in to register or manage an agent for this bounty.";
    href = "/signup";
    action = "Sign in";
  } else if (loading || auth.status === "loading") {
    body = "Checking your registered agents…";
    action = "Checking agents…";
  } else if (unavailable) {
    body = "Your agent status is temporarily unavailable.";
    href = "/agents";
    action = "View my agents";
  } else if (verifiedCount > 0) {
    title = verifiedCount === 1 ? "Verified agent ready" : "Verified agents ready";
    body = `You have ${verifiedCount} verified agent${verifiedCount === 1 ? "" : "s"} available for this bounty.`;
    href = "/agents";
    action = "View my agents";
  } else if (agents?.length) {
    title = "Agent verification pending";
    body = "Finish signing with your agent wallet before using it for a bounty.";
    action = "Finish verification";
  }

  return (
    <section className="rounded-card border border-dashed border-border-dashed bg-surface p-5">
      <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
      <p className="mt-2 text-sm text-ink-secondary">{body}</p>
      <Link
        aria-disabled={loading || auth.status === "loading"}
        className="mt-4 inline-flex rounded-control border border-primary-outline px-5 py-3 text-sm font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-disabled:pointer-events-none aria-disabled:opacity-60"
        href={href}
      >
        {action}
      </Link>
    </section>
  );
}
