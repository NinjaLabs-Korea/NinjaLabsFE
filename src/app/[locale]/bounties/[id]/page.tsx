import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Badge } from "@/components/ui/Badge";
import { BountyAgentPanel } from "@/components/agents/BountyAgentPanel";
import { BountyActionPanel } from "@/components/bounties/BountyActionPanel";
import { Markdown } from "@/components/ui/Markdown";
import { RewardPill } from "@/components/ui/RewardPill";
import { getPathname, Link } from "@/i18n/navigation";
import { getRuntimeBounty } from "@/lib/bounties";

type BountyDetailPageProps = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata({ params }: BountyDetailPageProps): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "bounties.meta" });
  const bounty = await getRuntimeBounty(id);

  if (!bounty) {
    return { title: t("notFound") };
  }

  const title = t("detailTitle", { title: bounty.applicationRequired && bounty.applicationTitle ? bounty.applicationTitle : bounty.title });

  return {
    title,
    description: bounty.summary,
    openGraph: { title, description: bounty.summary, url: getPathname({ locale, href: `/bounties/${bounty.slug}` }) },
  };
}

export default async function BountyDetailPage({ params }: BountyDetailPageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("bounties");
  const tAgents = await getTranslations("agents.panel");
  const bounty = await getRuntimeBounty(id);

  if (!bounty) {
    notFound();
  }

  const deliverables = bounty.deliverables ?? [];
  // API bounties carry no completion steps; fall back to localized generic steps.
  const completionSteps = bounty.completionSteps?.length
    ? bounty.completionSteps
    : [t("detail.defaultSteps.work"), t("detail.defaultSteps.submit"), t("detail.defaultSteps.approval")];
  const isClosedDeadline = bounty.deadline === "Closed";

  return (
    <div className="mx-auto max-w-content px-6 py-16 pb-20">
      <Link
        className="text-sm font-semibold text-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        href="/bounties"
      >
        {t("detail.back")}
      </Link>

      <section className="mt-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <h1 className="font-display text-5xl -tracking-[0.48px] text-ink">
            {bounty.applicationRequired && bounty.applicationTitle ? bounty.applicationTitle : bounty.title}
          </h1>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="primary-soft">{t(`categories.${bounty.category}`)}</Badge>
            <Badge variant={bounty.status === "active" ? "success" : "danger"}>
              {bounty.status === "active" ? <span className="mr-1.5 inline-block size-1.5 rounded-full bg-success" /> : null}
              {bounty.status === "active" ? t("status.active") : t("status.closed")}
            </Badge>
            <Badge variant="neutral">{bounty.submissionMode === "agent" ? t("detail.agentSubmission") : t("detail.directSubmission")}</Badge>
            {bounty.applicationRequired ? <Badge variant="warning">{t("detail.intakeOn")}</Badge> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="success">{t("detail.publicView")}</Badge>
          <Badge variant="danger">{t("detail.actionsRequireLogin")}</Badge>
        </div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <article className="rounded-card border border-border bg-surface p-5 shadow-card">
            <h2 className="font-display text-2xl -tracking-[0.24px] text-ink">{t("detail.description")}</h2>
            {bounty.applicationRequired && bounty.applicationDescription ? (
              <p className="mt-4 text-base text-ink-secondary">{bounty.applicationDescription}</p>
            ) : (
              <div className="mt-4">
                <Markdown>{bounty.descriptionMarkdown ?? bounty.summary}</Markdown>
              </div>
            )}
            {!bounty.applicationRequired ? (
              <>
                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  <MetaCell label={t("detail.deliverable")}>
                    {deliverables.map((deliverable) => <span key={deliverable}>{deliverable}</span>)}
                  </MetaCell>
                  <MetaCell label={t("detail.deadline")}>{bounty.deadlineDetail ?? (isClosedDeadline ? t("status.closed") : bounty.deadline)}</MetaCell>
                  <MetaCell label={t("detail.review")}>{bounty.reviewProcess ?? t("detail.defaultReview")}</MetaCell>
                </div>
                {bounty.submissionGuideMarkdown ? (
                  <>
                    <h3 className="mt-8 font-display text-lg font-bold text-ink">{t("detail.submissionGuide")}</h3>
                    <div className="mt-3">
                      <Markdown>{bounty.submissionGuideMarkdown}</Markdown>
                    </div>
                  </>
                ) : null}
              </>
            ) : null}
          </article>

          <BountyActionPanel bountyId={bounty.slug} applicationRequired={Boolean(bounty.applicationRequired)} submissionMode={bounty.submissionMode ?? "direct"} />
        </div>

        {bounty.applicationRequired ? <ApplyAside agentCopy={tAgents("copyApply")} reward={bounty.reward} submissionMode={bounty.submissionMode ?? "direct"} /> : <DirectAside agentCopy={tAgents("copyDirect")} completionSteps={completionSteps} reward={bounty.reward} submissionMode={bounty.submissionMode ?? "direct"} />}
      </div>

      {bounty.applicationRequired ? (
        <p className="mt-8 text-center text-sm text-ink-muted">
          {t("detail.applyFootnote")}
        </p>
      ) : null}
    </div>
  );
}

function DirectAside({ agentCopy, completionSteps, reward, submissionMode }: { agentCopy: string; completionSteps: string[]; reward: { amount: number; currency: "INJ" | "USDC" }; submissionMode: "direct" | "agent" }) {
  const t = useTranslations("bounties.detail");
  return (
    <aside className="space-y-5">
      <section className="rounded-card border border-primary-soft-border bg-primary-soft p-5">
        <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{t("reward")}</p>
        <p className="mt-3 font-display text-2xl -tracking-[0.24px] text-ink">{reward.amount} {reward.currency}</p>
        <div className="mt-4 flex items-center gap-2">
          <span className="text-sm text-ink-secondary">{t("sponsorPays")}</span>
          <RewardPill reward={reward} />
        </div>
      </section>
      <section className="rounded-card border border-border bg-surface p-5 shadow-card">
        <h2 className="font-display text-2xl -tracking-[0.24px] text-ink">{t("completionSteps")}</h2>
        <ol className="mt-4 space-y-3">
          {completionSteps.map((step, index) => (
            <li className="flex items-center gap-3 text-sm text-ink-secondary" key={step}>
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-success-soft text-xs font-bold text-success">{index + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      </section>
      {submissionMode === "agent" ? <BountyAgentPanel copy={agentCopy} /> : null}
    </aside>
  );
}

function ApplyAside({ agentCopy, reward, submissionMode }: { agentCopy: string; reward: { amount: number; currency: "INJ" | "USDC" }; submissionMode: "direct" | "agent" }) {
  const t = useTranslations("bounties.detail");
  return (
    <aside className="space-y-5">
      <section className="rounded-card border border-primary-soft-border bg-primary-soft p-5">
        <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{t("reward")}</p>
        <p className="mt-3 font-display text-2xl -tracking-[0.24px] text-ink">{reward.amount} {reward.currency}</p>
        <ol className="mt-4 space-y-3">
          <li className="flex gap-3 text-sm text-ink-secondary"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-bold text-primary">1</span>{t("applySteps.apply")}</li>
          <li className="flex gap-3 text-sm text-ink-secondary"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-bold text-primary">2</span>{t("applySteps.review")}</li>
          <li className="flex gap-3 text-sm text-ink-secondary"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-bold text-primary">3</span>{t("applySteps.submit")}</li>
        </ol>
      </section>
      <section className="rounded-card border border-border bg-surface p-5 shadow-card">
        <h2 className="font-display text-2xl -tracking-[0.24px] text-ink">{t("afterApproval")}</h2>
        <ol className="mt-4 space-y-3">
          <li className="flex gap-3 text-sm text-ink-secondary"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-success-soft text-xs font-bold text-success">1</span>{t("afterApprovalSteps.scope")}</li>
          <li className="flex gap-3 text-sm text-ink-secondary"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-success-soft text-xs font-bold text-success">2</span>{t("afterApprovalSteps.link")}</li>
          <li className="flex gap-3 text-sm text-ink-secondary"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-success-soft text-xs font-bold text-success">3</span>{t("afterApprovalSteps.reward")}</li>
        </ol>
      </section>
      {submissionMode === "agent" ? <BountyAgentPanel copy={agentCopy} /> : null}
    </aside>
  );
}

function MetaCell({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="rounded-tile border border-border bg-surface-subtle p-4">
      <p className="text-sm font-bold text-ink">{label}</p>
      <div className="mt-2 flex flex-col gap-1 text-sm text-ink-muted">{children}</div>
    </div>
  );
}
