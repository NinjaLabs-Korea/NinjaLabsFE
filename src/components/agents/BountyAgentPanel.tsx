"use client";

import { useTranslations } from "next-intl";
import { useAccountQuery } from "@/components/account/useAccountQuery";
import {
  useAuthSnapshot,
  useAccountApi,
} from "@/components/auth/FoundationProvider";
import { Badge } from "@/components/ui/Badge";
import { Link } from "@/i18n/navigation";

/** "Submit via agent" aside (Figma 15/15v): copy adapts to the viewer's agent status, the LOGIN badge shows until signed in. */
export function BountyAgentPanel({ copy }: { copy: string }) {
  const t = useTranslations("agents.panel");
  const auth = useAuthSnapshot();
  const apiClient = useAccountApi();
  const { data: agents, loading, unavailable, reason } = useAccountQuery(apiClient.getAgents);
  const verifiedCount = agents?.filter((agent) => agent.verified).length ?? 0;
  // Only PENDING_VERIFICATION agents can still be finished; a REVOKED-only owner starts over with the register CTA.
  const pendingCount = agents?.filter((agent) => agent.status === "PENDING_VERIFICATION").length ?? 0;

  let title = t("title");
  let body = copy;
  let href = "/agents/register";
  let action = t("action");

  if (auth.status === "signed-out") {
    href = "/signup";
  } else if (loading || auth.status === "loading") {
    body = t("checkingBody");
    action = t("checkingAction");
  } else if (unavailable && reason === "unauthorized") {
    // Session rejected by the BE (401/403 after refresh): a sign-in prompt, not the "temporarily unavailable" copy.
    body = t("sessionExpiredBody");
    href = "/signup";
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
