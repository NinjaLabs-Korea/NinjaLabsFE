import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import {
  BountyApplyAuthBadge,
  BountyApplyGuideCta,
} from "@/components/bounties/BountyApplyGuideCta";
import { Badge } from "@/components/ui/Badge";
import { Link } from "@/i18n/navigation";
import { loadRuntimeBounties, pickGuideBounties } from "@/lib/bounties";
import { localeMetadata } from "@/i18n/alternates";

// Keys under bounties.apply.statuses, with the 16 chip tones.
const statuses = [
  { key: "open", variant: "primary-soft" },
  { key: "underReview", variant: "warning" },
  { key: "approved", variant: "success" },
  { key: "submitted", variant: "primary-soft" },
  { key: "completed", variant: "success" },
] as const;

type BountyApplyPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: BountyApplyPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "bounties.meta.apply" });
  return localeMetadata(locale, "/bounties/apply", { title: t("title"), description: t("description") });
}

export default async function BountyApplyPage({ params }: BountyApplyPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("bounties.apply");
  const tBounties = await getTranslations("bounties");
  const { bounties, unavailable } = await loadRuntimeBounties(locale);
  const { applicationBounty, directBounty } = pickGuideBounties(bounties);
  const hasOpenBounty = Boolean(applicationBounty || directBounty);

  return (
    <div className="mx-auto max-w-content px-6 py-16 pb-20">
      <section className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
        <div className="max-w-[62rem]">
          <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{t("eyebrow")}</p>
          <h1 className="mt-3 font-display text-4xl -tracking-[0.36px] sm:text-5xl sm:-tracking-[0.48px] text-ink">{t("heading")}</h1>
          <p className="mt-4 max-w-[48rem] text-lg text-ink-secondary">
            {t("intro")}
          </p>
        </div>
        <BountyApplyAuthBadge />
      </section>

      <section className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
        <article className="flex min-h-full flex-col rounded-card border border-border bg-surface p-[21px] shadow-card">
          <Badge variant="success">{t("submitType.badge")}</Badge>
          <h2 className="mt-4 font-display text-2xl font-bold -tracking-[0.24px] text-ink">{t("submitType.heading")}</h2>
          <p className="mt-3 text-base text-ink-secondary">{t("submitType.body")}</p>
          <div className="mt-5 rounded-tile bg-primary-soft p-4">
            <p className="text-base font-semibold text-ink">{t("submitType.flowTitle")}</p>
            <p className="mt-1 text-sm text-ink-secondary">{t("submitType.flow")}</p>
          </div>
          {directBounty ? (
            <Link
              className="mt-5 inline-flex w-fit rounded-control border border-primary-outline px-5 py-3 text-sm font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              href={`/bounties/${directBounty.slug}`}
            >
              {t("submitType.viewDirect")}
            </Link>
          ) : hasOpenBounty ? (
            <p className="mt-5 text-sm text-ink-muted">{t("submitType.none")}</p>
          ) : null}
        </article>

        <article className="flex min-h-full flex-col rounded-card border border-border bg-surface p-[21px] shadow-card">
          <Badge variant="warning">{t("applyType.badge")}</Badge>
          <h2 className="mt-4 font-display text-2xl font-bold -tracking-[0.24px] text-ink">{t("applyType.heading")}</h2>
          <p className="mt-3 text-base text-ink-secondary">{t("applyType.body")}</p>
          <div className="mt-5 rounded-tile bg-primary-soft p-4">
            <p className="text-base font-semibold text-ink">{t("applyType.flowTitle")}</p>
            <p className="mt-1 text-sm text-ink-secondary">{t("applyType.flow")}</p>
          </div>
          {applicationBounty ? (
            <BountyApplyGuideCta bountyHref={`/bounties/${applicationBounty.slug}`} />
          ) : hasOpenBounty ? (
            <p className="mt-5 text-sm text-ink-muted">{t("applyType.none")}</p>
          ) : null}
        </article>
      </section>

      {unavailable ? (
        <section className="mt-6 rounded-tile border border-dashed border-border-dashed bg-surface-subtle p-5" role="status">
          <p className="text-sm font-semibold text-ink">{t("unavailable")}</p>
          <p className="mt-1 text-sm text-ink-muted">{tBounties("unavailableBody")}</p>
        </section>
      ) : !hasOpenBounty ? (
        <section className="mt-6 flex flex-col items-start justify-between gap-4 rounded-card border border-border bg-surface p-5 shadow-card sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-xl font-bold text-ink">{t("empty.title")}</h2>
            <p className="mt-1 text-sm text-ink-muted">{t("empty.body")}</p>
          </div>
          <Link
            className="inline-flex shrink-0 rounded-control bg-primary px-5 py-3 text-sm font-semibold text-on-inverse hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            href="/bounties"
          >
            {t("empty.browse")}
          </Link>
        </section>
      ) : null}

      <section className="mt-8 rounded-card border border-border bg-surface p-[21px] shadow-card">
        <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{t("statusEyebrow")}</p>
        <h2 className="mt-2 font-display text-2xl -tracking-[0.24px] text-ink">{t("statusHeading")}</h2>
        <ol className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-0">
          {statuses.map((status, index) => (
            <li className="flex flex-1 items-center gap-3 sm:gap-0" key={status.key}>
              <Badge variant={status.variant}>{t(`statuses.${status.key}`)}</Badge>
              {index < statuses.length - 1 ? <span className="mx-3 hidden h-px flex-1 bg-border sm:block" /> : null}
            </li>
          ))}
        </ol>
      </section>

      <p className="mt-4 text-sm text-ink-muted">{t("statusNote")}</p>
    </div>
  );
}
