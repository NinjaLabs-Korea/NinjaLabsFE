"use client";

import { useTranslations } from "next-intl";
import { SignedOutPanel } from "@/components/account/SignedOutPanel";
import { useAccountQuery } from "@/components/account/useAccountQuery";
import {
  useAuthSnapshot,
  useFoundationApiClient,
  useFoundationMode,
} from "@/components/auth/FoundationProvider";
import { Badge } from "@/components/ui/Badge";
import { Link } from "@/i18n/navigation";

const focusClass =
  "hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function AgentsView() {
  const t = useTranslations("agents.list");
  const tAccount = useTranslations("account.common");
  const mode = useFoundationMode();
  const authSnapshot = useAuthSnapshot();
  const apiClient = useFoundationApiClient();
  const { data: agents, unavailable } = useAccountQuery(apiClient.getAgents);

  if (unavailable) {
    return (
      <div className="rounded-tile border border-dashed border-border-dashed bg-surface-subtle p-10 text-center">
        <p className="text-sm font-semibold text-ink">{t("unavailableTitle")}</p>
        <p className="mt-1 text-sm text-ink-muted">{tAccount("unavailableBody")}</p>
      </div>
    );
  }

  if (authSnapshot.status !== "signed-in") {
    return <SignedOutPanel message={t("signedOutMessage")} />;
  }

  if (!agents) {
    return null;
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{tAccount("eyebrow")}</p>
          <h1 className="mt-2 font-display text-5xl -tracking-[0.48px] text-ink">{t("heading")}</h1>
          <p className="mt-4 text-lg text-ink-muted">
            {t("intro")}
          </p>
        </div>
        <Link
          className={`rounded-control border border-primary-outline px-[21px] py-3 text-sm leading-[21px] font-semibold text-primary-strong ${focusClass}`}
          href="/agents/register"
        >
          {t("registerNew")}
        </Link>
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {agents.map((agent) => (
          <article className="rounded-card border border-dashed border-border bg-surface p-5" key={agent.name}>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg font-bold text-ink">{agent.name}</h2>
              {agent.verified ? <Badge variant="success">{t("verified")}</Badge> : <Badge variant="neutral">{t("unverified")}</Badge>}
            </div>
            <p className="mt-1 text-sm text-ink-muted">{agent.walletAddress}</p>

            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <dt className="font-semibold text-ink">{t("apiKey")}</dt>
                <dd className="text-ink-secondary">{agent.apiKeyMasked}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-semibold text-ink">{t("registered")}</dt>
                <dd className="text-ink-secondary">{agent.registeredAt}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-semibold text-ink">{t("completedBounties")}</dt>
                <dd className="text-ink-secondary">{agent.completedBounties}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      {mode === "mock" ? (
        <p className="mt-3 text-xs text-ink-muted">{tAccount("mockNote")}</p>
      ) : null}
    </>
  );
}
