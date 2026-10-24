import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { Badge } from "@/components/ui/Badge";
import { BountyAgentPanel } from "@/components/agents/BountyAgentPanel";
import { BountyActionPanel } from "@/components/bounties/BountyActionPanel";
import { Markdown } from "@/components/ui/Markdown";
import { isRewardUnset, RewardPill } from "@/components/ui/RewardPill";
import { getPathname, Link } from "@/i18n/navigation";
import { getRuntimeBounty } from "@/lib/bounties";
import { validateDetailId } from "@/lib/detail-id";
import type { Reward } from "@/lib/types";
import { localeAlternates } from "@/i18n/alternates";

type BountyDetailPageProps = {
  params: Promise<{ locale: string; id: string }>;
};

// Keys under bounties.detail.completionSteps / afterApprovalSteps / bounties.apply.statuses.
const completionStepKeys = ["transfer", "mint", "attach"] as const;
const afterApprovalStepKeys = ["approve", "unlock", "reward"] as const;
const applyStatuses = [
  { key: "open", variant: "primary-soft" },
  { key: "underReview", variant: "warning" },
  { key: "approved", variant: "neutral" },
  { key: "submitted", variant: "neutral" },
  { key: "completed", variant: "neutral" },
] as const;

export async function generateMetadata({ params }: BountyDetailPageProps): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "bounties.meta" });
  const bounty = (await validateDetailId("bounties", id)) ? await getRuntimeBounty(id, locale) : undefined;

  if (!bounty) {
    return { alternates: {}, title: t("notFound") };
  }

  const title = t("detailTitle", { title: bounty.applicationRequired && bounty.applicationTitle ? bounty.applicationTitle : bounty.title });

  return {
    alternates: localeAlternates(locale, `/bounties/${bounty.slug}`),
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
  const tReward = await getTranslations("common.reward");
  const format = await getFormatter();
  // Shape check before the fetch (api: UUID, mock: slug); the layout already did it, this keeps the page self-contained.
  if (!(await validateDetailId("bounties", id))) notFound();
  const bounty = await getRuntimeBounty(id, locale);

  if (!bounty) {
    notFound();
  }

  const applicationRequired = Boolean(bounty.applicationRequired);
  const submissionMode = bounty.submissionMode ?? "direct";
  const deliverables = bounty.deliverables ?? [];
  const rewards = bounty.rewards ?? [bounty.reward];
  const isClosedDeadline = bounty.deadline === "Closed";
  const stepKeys = applicationRequired ? afterApprovalStepKeys : completionStepKeys;
  const stepNamespace = applicationRequired ? "detail.afterApprovalSteps" : "detail.completionSteps";

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
            {applicationRequired && bounty.applicationTitle ? bounty.applicationTitle : bounty.title}
          </h1>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="primary-soft">{t(`categories.${bounty.category}`)}</Badge>
            <Badge variant={bounty.status === "active" ? "success" : bounty.status === "reviewing" ? "warning" : "danger"}>
              {bounty.status === "active" ? <span className="mr-1.5 inline-block size-1.5 rounded-full bg-success" /> : null}
              {t(`status.${bounty.status}`)}
            </Badge>
            {applicationRequired
              ? <Badge variant="warning">{t("detail.applicationRequired")}</Badge>
              : <Badge variant="neutral">{submissionMode === "agent" ? t("detail.agentSubmission") : t("detail.directSubmission")}</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="success">{t("detail.publicView")}</Badge>
          <Badge variant="danger">{t("detail.actionsRequireLogin")}</Badge>
        </div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <article className="rounded-card border border-border bg-surface p-[21px] shadow-card">
            <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{t("detail.description")}</p>
            <h2 className="mt-2 font-display text-2xl -tracking-[0.24px] text-ink">{applicationRequired ? t("detail.descriptionHeadingApply") : t("detail.descriptionHeading")}</h2>
            {applicationRequired && bounty.applicationDescription ? (
              <p className="mt-4 text-base text-ink-secondary">{bounty.applicationDescription}</p>
            ) : (
              <div className="mt-4">
                <Markdown>{bounty.descriptionMarkdown ?? bounty.summary}</Markdown>
              </div>
            )}
            {!applicationRequired ? (
              <>
                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  <MetaCell label={t("detail.deliverable")}>
                    {deliverables.length > 0
                      ? deliverables.map((deliverable) => <span key={deliverable}>{deliverable}</span>)
                      : <span>{bounty.submissionGuideMarkdown ? t("detail.deliverableSeeGuide") : t("detail.deliverableDescribed")}</span>}
                  </MetaCell>
                  <MetaCell label={t("detail.deadline")}>{bounty.deadlineDetail || t(isClosedDeadline ? "status.closed" : "status.active")}</MetaCell>
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

          <BountyActionPanel bountyId={bounty.slug} applicationRequired={applicationRequired} status={bounty.status} submissionMode={submissionMode} />

          {applicationRequired ? (
            <section className="rounded-card border border-border bg-surface p-[21px] shadow-card">
              <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{t("detail.statusFlowEyebrow")}</p>
              <ol className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-0">
                {applyStatuses.map((status, index) => (
                  <li className="flex flex-1 items-center gap-3 sm:gap-0" key={status.key}>
                    <Badge variant={status.variant}>{t(`apply.statuses.${status.key}`)}</Badge>
                    {index < applyStatuses.length - 1 ? <span className="mx-3 hidden h-px flex-1 bg-border sm:block" /> : null}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>

        <aside className="space-y-5">
          <section className="rounded-card border border-primary-soft-border bg-primary-soft p-[21px]">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{t("detail.rewardInfo")}</p>
              {rewards.map((reward) => <SponsorPaysPill key={reward.currency} label={t("detail.sponsorPays", { reward: isRewardUnset(reward) ? tReward("tbd") : `${format.number(reward.amount, { maximumFractionDigits: 6 })} ${reward.currency}` })} reward={reward} />)}
            </div>
            <ol className="mt-4 space-y-3">
              {(["flow", "token", "noSwap"] as const).map((note, index) => (
                <li className="flex gap-3 text-sm text-ink-secondary" key={note}>
                  <span className="shrink-0 text-xs font-bold leading-5 text-primary">{index + 1}</span>
                  {applicationRequired ? t(`detail.rewardNotesApply.${note}`, { currency: rewards[0].currency }) : t(`detail.rewardNotes.${note}`)}
                </li>
              ))}
            </ol>
          </section>
          <section className="rounded-card border border-border bg-surface p-[21px] shadow-card">
            <h2 className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{applicationRequired ? t("detail.afterApproval") : t("detail.completionHeading")}</h2>
            <ol className="mt-4 space-y-3">
              {stepKeys.map((step, index) => (
                <li className="flex gap-3 text-sm text-ink-secondary" key={step}>
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-success-soft text-xs font-bold text-success">{index + 1}</span>
                  {t(`${stepNamespace}.${step}`)}
                </li>
              ))}
            </ol>
          </section>
          <BountyAgentPanel copy={applicationRequired ? tAgents("copyApply") : tAgents("copyDirect")} />
        </aside>
      </div>

      <p className="mt-8 text-sm text-ink-muted">
        {applicationRequired ? t("detail.applyFootnote") : t("detail.footnote")}
      </p>
    </div>
  );
}

function SponsorPaysPill({ label, reward }: { label: string; reward: Reward }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-control border border-primary-soft-border bg-surface px-[13px] py-1.5 font-display text-sm font-bold text-ink">
      <RewardPill reward={reward} variant="icon" />
      {label}
    </span>
  );
}

function MetaCell({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="rounded-tile border border-primary-soft-border bg-primary-soft p-4">
      <p className="text-sm font-bold text-ink">{label}</p>
      <div className="mt-2 flex flex-col gap-1 text-sm text-ink-muted">{children}</div>
    </div>
  );
}
