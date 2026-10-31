"use client";

import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { useAccountQuery } from "@/components/hooks/useAccountQuery";
import {
  useAuthSnapshot,
  useAccountApi,
} from "@/components/auth/FoundationProvider";
import { Badge } from "@/components/ui/Badge";
import { Link } from "@/i18n/navigation";
import { describeAgentKey } from "@/lib/agent-keys";
import { signInHref } from "@/lib/return-path";

/** "Submit via agent" aside (Figma 15/15v): copy adapts to the viewer's agent status, the LOGIN badge shows until signed in. */
export function BountyAgentPanel({ copy, returnTo }: { copy: string; /** Locale-less page to come back to after signing in. */ returnTo?: string }) {
  const t = useTranslations("agents.panel");
  const auth = useAuthSnapshot();
  const apiClient = useAccountApi();
  const { data: agents, loading, unavailable, reason } = useAccountQuery(apiClient.getAgents);
  // A verified agent whose API key expired (or was revoked) cannot call the Agent API: it is not "ready", it needs a rotation.
  const verifiedAgents = agents?.filter((agent) => agent.verified) ?? [];
  const keyUnusable = (agent: (typeof verifiedAgents)[number]) => {
    const key = describeAgentKey(agent).kind;
    return key === "expired" || key === "revoked";
  };
  const verifiedCount = verifiedAgents.filter((agent) => !keyUnusable(agent)).length;
  const expiredKeyCount = verifiedAgents.length - verifiedCount;
  // Only PENDING_VERIFICATION agents can still be finished; a REVOKED-only owner starts over with the register CTA.
  const pendingCount = agents?.filter((agent) => agent.status === "PENDING_VERIFICATION").length ?? 0;

  let title = t("title");
  let body = copy;
  const signIn: ComponentProps<typeof Link>["href"] = returnTo ? signInHref(returnTo) : "/signup";
  let href: ComponentProps<typeof Link>["href"] = "/agents/register";
  let action = t("action");

  if (auth.status === "signed-out") {
    href = signIn;
  } else if (loading || auth.status === "loading") {
    body = t("checkingBody");
    action = t("checkingAction");
  } else if (unavailable && reason === "unauthorized") {
    // Session rejected by the BE (401/403 after refresh): a sign-in prompt, not the "temporarily unavailable" copy.
    body = t("sessionExpiredBody");
    href = signIn;
    action = t("signIn");
  } else if (unavailable) {
    body = t("unavailableBody");
    href = "/agents";
    action = t("viewAgents");
  } else if (verifiedCount > 0) {
    title = t("verifiedTitle", { count: verifiedCount });
    body = t("verifiedBody", { count: verifiedCount });
    href = "/agents";
    action = t("viewAgents");
  } else if (expiredKeyCount > 0) {
    title = t("keyExpiredTitle");
    body = t("keyExpiredBody");
    href = "/agents";
    action = t("rotateKey");
  } else if (pendingCount > 0) {
    title = t("pendingTitle");
    body = t("pendingBody");
    action = t("finish");
  }

  return (
    <section className="rounded-card border border-dashed border-border-dashed bg-surface p-[21px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
        {auth.status === "signed-in" ? null : <Badge variant="danger">{t("loginBadge")}</Badge>}
      </div>
      <p className="mt-2 text-sm text-ink-secondary">{body}</p>
      <Link
        aria-disabled={loading || auth.status === "loading"}
        className="mt-4 flex w-full items-center justify-center rounded-control border border-primary-outline px-5 py-3 text-sm font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-disabled:pointer-events-none aria-disabled:opacity-60"
        href={href}
      >
        {action}
      </Link>
    </section>
  );
}
