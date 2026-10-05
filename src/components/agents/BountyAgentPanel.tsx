"use client";

import { useTranslations } from "next-intl";
import { useAccountQuery } from "@/components/account/useAccountQuery";
import {
  useAuthSnapshot,
  useAccountApi,
} from "@/components/auth/FoundationProvider";
import { Link } from "@/i18n/navigation";

export function BountyAgentPanel({ copy }: { copy: string }) {
  const t = useTranslations("agents.panel");
  const auth = useAuthSnapshot();
  const apiClient = useAccountApi();
  const { data: agents, loading, unavailable } = useAccountQuery(apiClient.getAgents);
  const verifiedCount = agents?.filter((agent) => agent.verified).length ?? 0;

  let title = t("title");
  let body = copy;
  let href = "/agents/register";
  let action = t("action");

  if (auth.status === "signed-out") {
    body = t("signedOutBody");
    href = "/signup";
    action = t("signIn");
  } else if (loading || auth.status === "loading") {
    body = t("checkingBody");
    action = t("checkingAction");
  } else if (unavailable) {
    body = t("unavailableBody");
    href = "/agents";
    action = t("viewAgents");
  } else if (verifiedCount > 0) {
    title = t("verifiedTitle", { count: verifiedCount });
    body = t("verifiedBody", { count: verifiedCount });
    href = "/agents";
    action = t("viewAgents");
  } else if (agents?.length) {
    title = t("pendingTitle");
    body = t("pendingBody");
    action = t("finish");
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
