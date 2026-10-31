"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import { useAccountQuery } from "@/components/hooks/useAccountQuery";
import { useAuthSnapshot, useCohortApi, useFoundationMode } from "@/components/auth/FoundationProvider";
import { MyCohortApplications } from "@/components/account/MyCohortApplications";
import { CohortApplicationCard } from "@/components/recruit/CohortApplicationCard";
import { CohortApplicationForm } from "@/components/recruit/CohortApplicationForm";
import { RecruitNotice } from "@/components/recruit/RecruitNotice";
import { useCurrentCohort } from "@/components/hooks/useCurrentCohort";
import { Badge } from "@/components/ui/Badge";
import { Link } from "@/i18n/navigation";
import { getOnboardingPath } from "@/lib/auth-route";
import { cohortPhase, resolveCohortApplyView, type PublicCohort } from "@/lib/cohorts";
import { rememberReturnPath } from "@/lib/return-path";
import { PageLoading } from "@/components/ui/PageLoading";

const primaryLinkClass =
  "rounded-control bg-primary px-[21px] py-3 text-sm leading-[21px] font-semibold text-on-inverse hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const secondaryLinkClass =
  "rounded-control border border-primary-outline px-[21px] py-3 text-sm leading-[21px] font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/** The two ways out of a page with no form: what the community announces, and what it has done so far. */
function PastActivityActions() {
  const t = useTranslations("recruit.states.actions");
  return (
    <>
      <Link className={primaryLinkClass} href="/notices">{t("notices")}</Link>
      <Link className={secondaryLinkClass} href="/notices?category=events">{t("past")}</Link>
    </>
  );
}

const phaseVariant = { open: "success", upcoming: "warning", closed: "neutral" } as const;

function CohortInfo({ cohort }: { cohort: PublicCohort }) {
  const t = useTranslations("recruit");
  const format = useFormatter();
  const phase = cohortPhase(cohort);
  const date = (value: string) => format.dateTime(new Date(value), { dateStyle: "medium" });
  const period =
    cohort.opensAt && cohort.closesAt
      ? t("cohort.periodRange", { from: date(cohort.opensAt), to: date(cohort.closesAt) })
      : cohort.closesAt
        ? t("cohort.periodUntil", { to: date(cohort.closesAt) })
        : cohort.opensAt
          ? t("cohort.periodFrom", { from: date(cohort.opensAt) })
          : t("cohort.periodOpen");
  return (
    <section aria-labelledby="cohort-name" className="mx-auto max-w-content px-gutter">
      <div className="rounded-card border border-border bg-surface p-5 shadow-card sm:p-[21px]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{t("cohort.eyebrow")}</p>
            <h2 className="mt-1 break-words font-display text-2xl text-ink" id="cohort-name">{cohort.name}</h2>
          </div>
          <Badge variant={phaseVariant[phase]}>{t(`cohort.phase.${phase}`)}</Badge>
        </div>
        {cohort.description ? <p className="mt-4 whitespace-pre-line break-words text-base text-ink-muted">{cohort.description}</p> : null}
        <p className="mt-4 text-sm font-semibold text-ink">{period}</p>
      </div>
    </section>
  );
}

/**
 * `/recruit` below the masthead: the open cohort, then (between them, `aboutSlot`) what Ninja Labs does, then the application area,
 * which follows the viewer: signed out -> sign-in; onboarding unfinished -> the step they owe; no application -> the form;
 * SUBMITTED -> status with Edit/Withdraw; ACCEPTED / REJECTED -> status only (the reviewer's note is never shown); WITHDRAWN -> the form again.
 */
export function RecruitView({ aboutSlot }: { aboutSlot: ReactNode }) {
  const t = useTranslations("recruit");
  const auth = useAuthSnapshot();
  const mode = useFoundationMode();
  const api = useCohortApi();
  const current = useCurrentCohort();
  const mine = useAccountQuery(api.getMyCohortApplications);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState<"submitted" | "updated" | null>(null);

  const user = auth.status === "signed-in" ? auth.user : null;
  // The mock preview user has no onboarding fields: it counts as finished so the form stays reviewable without a backend.
  const finished = user !== null && (mode === "mock" || user.onboardingCompleted === true);
  const onboardingPath = user && !finished ? getOnboardingPath(user) : null;

  // Come back here once the owed onboarding step is done (the last signup step offers the link).
  useEffect(() => {
    if (onboardingPath) rememberReturnPath("/recruit");
  }, [onboardingPath]);

  const refreshAll = () => {
    mine.refresh();
    current.reload();
  };

  let body: ReactNode;
  const cohort = current.cohort;
  if (current.status === "loading") {
    body = <PageLoading label={t("states.loading")} variant="list" />;
  } else if (current.status === "failed") {
    body = (
      <RecruitNotice body={t("states.failed.body")} title={t("states.failed.title")}>
        <button className={secondaryLinkClass} onClick={current.retry} type="button">{t("states.retry")}</button>
      </RecruitNotice>
    );
  } else if (!cohort) {
    body = (
      <RecruitNotice body={t("states.noCohort.body")} title={t("states.noCohort.title")}>
        <PastActivityActions />
      </RecruitNotice>
    );
  } else if (auth.status === "loading") {
    body = <p className="text-sm text-ink-muted" role="status">{t("states.checking")}</p>;
  } else if (!user) {
    body = cohort.acceptingApplications ? (
      <RecruitNotice body={t("states.signIn.body")} title={t("states.signIn.title")}>
        <Link className={primaryLinkClass} href={{ pathname: "/signup", query: { returnTo: "/recruit" } }}>{t("states.signIn.cta")}</Link>
      </RecruitNotice>
    ) : (
      <RecruitNotice body={t("states.notAccepting.body")} title={t(`states.notAccepting.title.${cohortPhase(cohort)}`)}>
        <PastActivityActions />
      </RecruitNotice>
    );
  } else if (!finished) {
    body = (
      <RecruitNotice body={t("states.onboarding.body")} title={t("states.onboarding.title")}>
        {onboardingPath ? <Link className={primaryLinkClass} href={onboardingPath}>{t("states.onboarding.cta")}</Link> : null}
      </RecruitNotice>
    );
  } else if (mine.loading) {
    body = <p className="text-sm text-ink-muted" role="status">{t("states.checking")}</p>;
  } else if (mine.unavailable || !mine.data) {
    body = mine.reason === "unauthorized" ? (
      <RecruitNotice body={t("states.signIn.body")} title={t("states.sessionExpired")}>
        <Link className={primaryLinkClass} href={{ pathname: "/signup", query: { returnTo: "/recruit" } }}>{t("states.signIn.cta")}</Link>
      </RecruitNotice>
    ) : (
      <RecruitNotice body={t("states.failed.body")} title={t("states.failed.title")}>
        <button className={secondaryLinkClass} onClick={mine.refresh} type="button">{t("states.retry")}</button>
      </RecruitNotice>
    );
  } else {
    const view = resolveCohortApplyView(cohort, mine.data);
    if (view.kind === "form") {
      body = (
        <div className="rounded-card border border-border bg-surface p-5 shadow-card sm:p-[21px]">
          <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{t("form.eyebrow")}</p>
          <h2 className="mt-1 font-display text-2xl text-ink">{t("form.title")}</h2>
          <p className="mt-2 text-sm text-ink-muted">{view.reapply ? t("form.reapplyIntro") : t("form.lead")}</p>
          <div className="mt-6">
            <CohortApplicationForm
              cohortId={cohort.id}
              onSaved={() => {
                setSaved("submitted");
                refreshAll();
              }}
              onStale={refreshAll}
            />
          </div>
        </div>
      );
    } else if (view.kind === "not-accepting") {
      body = (
        <RecruitNotice body={t("states.notAccepting.body")} title={t(`states.notAccepting.title.${cohortPhase(cohort)}`)}>
          <PastActivityActions />
        </RecruitNotice>
      );
    } else if (view.kind === "submitted" && editing) {
      body = (
        <div className="rounded-card border border-border bg-surface p-5 shadow-card sm:p-[21px]">
          <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{t("form.eyebrowEdit")}</p>
          <h2 className="mt-1 font-display text-2xl text-ink">{t("form.titleEdit")}</h2>
          <div className="mt-6">
            <CohortApplicationForm
              application={view.application}
              cohortId={cohort.id}
              onCancel={() => setEditing(false)}
              onSaved={() => {
                setEditing(false);
                setSaved("updated");
                refreshAll();
              }}
              onStale={() => {
                setEditing(false);
                refreshAll();
              }}
            />
          </div>
        </div>
      );
    } else {
      body = (
        <CohortApplicationCard
          application={view.application}
          onChanged={() => {
            setSaved(null);
            refreshAll();
          }}
          onEdit={view.kind === "submitted" ? () => { setSaved(null); setEditing(true); } : undefined}
        />
      );
    }
  }

  return (
    <>
      {cohort ? (
        <CohortInfo cohort={cohort} />
      ) : current.status === "loading" ? (
        // Reserve roughly the cohort card's height until the read settles: the card is inserted above the about section and
        // the application area, so without it the whole page (footer included) jumps down when it arrives (CLS 0.17).
        <div aria-hidden="true" className="mx-auto max-w-content px-gutter"><div className="min-h-[132px]" /></div>
      ) : null}
      {aboutSlot}
      <section aria-label={t("form.sectionLabel")} className="mx-auto max-w-content px-gutter pb-20">
        <div className="mx-auto max-w-[896px]">
          {saved ? (
            <p className="mb-5 rounded-tile border border-border bg-success-soft p-4 text-sm font-semibold text-success" role="status">{t(`form.saved.${saved}`)}</p>
          ) : null}
          {body}
        </div>
        {finished && current.status === "ready" ? (
          <div className="mx-auto mt-8 max-w-[896px]"><MyCohortApplications pastOf={cohort?.id ?? null} /></div>
        ) : null}
      </section>
    </>
  );
}
