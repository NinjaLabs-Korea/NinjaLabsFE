import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Badge } from "@/components/ui/Badge";
import { RewardPill } from "@/components/ui/RewardPill";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Link } from "@/i18n/navigation";
import { getRuntimeProfile } from "@/lib/members";

type MemberProfilePageProps = PageProps<"/[locale]/members/[id]">;

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: MemberProfilePageProps): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "members.profile" });
  const profile = await getRuntimeProfile(id);

  if (!profile) {
    return { title: t("notFoundTitle") };
  }

  return {
    title: t("pageTitle", { handle: profile.handle }),
    description: profile.bio,
    openGraph: {
      title: t("pageTitle", { handle: profile.handle }),
      description: profile.bio,
      url: `/${locale}/members/${id}`,
    },
  };
}

export default async function MemberProfilePage({ params }: MemberProfilePageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("members.profile");
  const profile = await getRuntimeProfile(id);
  if (!profile) notFound();
  const completed = profile.completions.length > 0;
  const parentNft = profile.nfts.find((nft) => nft.type === "parent");
  const completionNfts = profile.nfts.filter((nft) => nft.type === "completion");

  return (
    <div className="mx-auto max-w-content px-6 py-16 pb-20">
      <section className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-6 rounded-card border border-border bg-surface p-5 shadow-card">
          <div className="flex size-24 shrink-0 items-center justify-center rounded-full bg-primary-soft-border font-display text-[30px] text-primary">{profile.initials}</div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-5xl -tracking-[0.48px] text-ink">{profile.handle}</h1>
              {profile.skills.map((skill) => <Badge key={skill}>{t(`categories.${skill.toLowerCase()}`)}</Badge>)}
              <Badge variant={completed ? "success" : "neutral"}>{completed ? t("bountiesCompleted", { count: profile.completions.length }) : t("newBuilder")}</Badge>
            </div>
            <p className="mt-3 max-w-[768px] text-base text-ink-muted">{profile.bio}</p>
            <p className="mt-3 text-sm text-ink-muted">{t("joined", { date: profile.joinedAt })}</p>
          </div>
        </div>
        <Badge variant="success">{t("publicShareable")}</Badge>
      </section>

      <section className="mt-14 rounded-panel bg-[linear-gradient(160deg,var(--color-hero-from)_0%,var(--color-hero-via)_55%,var(--color-hero-to)_100%)] p-6 text-on-inverse shadow-frame sm:p-10">
        <div className="grid gap-8 lg:grid-cols-5 lg:items-center">
          <div className="lg:col-span-2">
            <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary-outline">{t("portfolio.eyebrow")}</p>
            <h2 className="mt-2 font-display text-4xl">{completed ? t("portfolio.headingCompleted") : t("portfolio.headingEmpty")}</h2>
            <p className="mt-4 text-base text-on-inverse/70">{completed ? t("portfolio.bodyCompleted") : t("portfolio.bodyEmpty")}</p>
          </div>
          <div className="rounded-card border border-on-inverse/15 bg-on-inverse/10 p-5 backdrop-blur-sm lg:col-span-3">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary-soft-border font-display text-sm text-primary">N</div>
              <div><p className="font-semibold">{t("portfolio.nftName")}</p><p className="text-sm text-on-inverse/60">{parentNft ? t("portfolio.parentNft", { status: t(`nftStatus.${parentNft.status}`) }) : t("portfolio.parentPending", { handle: profile.handle })}</p></div>
            </div>
            {completionNfts.length ? (
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {completionNfts.map((nft) => <div key={nft.id} className="flex aspect-square flex-col rounded-[14px] bg-[linear-gradient(135deg,var(--color-primary-strong)_0%,var(--color-primary)_55%,var(--color-primary-outline)_100%)] p-3 shadow-nft"><span className="text-sm font-semibold">{nft.title}</span><span className="mt-auto text-xs text-on-inverse/70">{t(`nftStatus.${nft.status}`)}</span>{nft.tokenId ? <span className="mt-1 truncate text-xs text-on-inverse/60" title={nft.tokenId}>{t("portfolio.token", { id: nft.tokenId })}</span> : null}{nft.mintTxHash ? <span className="mt-1 truncate text-xs text-on-inverse/60" title={nft.mintTxHash}>{t("portfolio.tx", { hash: nft.mintTxHash })}</span> : null}</div>)}
                <div className="flex aspect-square items-center justify-center rounded-[14px] border border-dashed border-on-inverse/30 text-sm text-on-inverse/70">{t("portfolio.next")}</div>
              </div>
            ) : (
              <div className="mt-5 flex min-h-72 flex-col items-center justify-center rounded-card border border-dashed border-on-inverse/25 bg-on-inverse/5 p-6 text-center">
                <div className="flex size-14 items-center justify-center rounded-[14px] bg-on-inverse/10 font-display text-xl">N</div>
                <h3 className="mt-4 font-display text-xl font-bold">{t("portfolio.emptyTitle")}</h3>
                <p className="mt-2 max-w-sm text-sm text-on-inverse/70">{completed ? t("portfolio.emptyBodyCompleted") : t("portfolio.emptyBodyNew")}</p>
                <Link className="mt-5 rounded-control bg-primary px-5 py-3 text-sm font-semibold text-on-inverse hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-outline" href="/bounties">{t("portfolio.browse")}</Link>
              </div>
            )}
            <p className="mt-4 text-sm text-on-inverse/60">{t("portfolio.nftCount", { count: completionNfts.length })}</p>
          </div>
        </div>
      </section>

      <section className="py-14">
        <SectionHeader eyebrow={t("history.eyebrow")} heading={t("history.heading")} action={!completed ? { label: t("history.viewFilled"), href: "/members/jaemin" } : undefined} />
        {completed ? (
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {profile.completions.slice(0, 3).map((completion) => {
              return (
                <Link className="rounded-card border border-border bg-surface p-5 shadow-card hover:shadow-frame focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href={completion.bountySlug ? `/bounties/${completion.bountySlug}` : "/bounties"} key={completion.title}>
                  <Badge>{t(`categories.${completion.category.toLowerCase()}`)}</Badge><h3 className="mt-3 font-display text-lg font-bold text-ink">{completion.title}</h3><p className="mt-2 text-sm text-ink-muted">{t("history.completedOn", { date: completion.completedAt })}</p><div className="mt-4"><RewardPill reward={completion.reward} /></div>
                </Link>
              );
            })}
          </div>
        ) : <div className="mt-6 flex min-h-72 flex-col items-center justify-center rounded-card border border-dashed border-border bg-surface-subtle p-6 text-center"><div className="flex size-14 items-center justify-center rounded-[14px] bg-primary-soft font-display text-xl text-primary">N</div><h3 className="mt-4 font-display text-xl font-bold text-ink">{t("history.emptyTitle")}</h3><p className="mt-2 text-sm text-ink-muted">{t("history.emptyBody")}</p><Link className="mt-5 rounded-control bg-primary px-5 py-3 text-sm font-semibold text-on-inverse hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href="/bounties">{t("history.findFirst")}</Link></div>}
      </section>

      <section id="agents">
        <SectionHeader eyebrow={t("agents.eyebrow")} heading={t("agents.heading")} />
        {profile.agents.length ? <div className="mt-6 grid gap-5 md:grid-cols-2">{profile.agents.map((agent) => <article key={agent.name} className="rounded-card border border-dashed border-border bg-surface p-5"><div className="flex flex-wrap items-center gap-2"><h3 className="font-display text-xl font-bold text-ink">{agent.name}</h3>{agent.verified ? <Badge variant="success">{t("agents.verified")}</Badge> : null}</div><p className="mt-3 text-sm text-ink-muted">{agent.wallet}</p><p className="mt-2 text-sm text-ink-muted">{t("agents.completed", { count: agent.completedBounties })}</p></article>)}</div> : <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-card border border-dashed border-border bg-surface p-5"><div><h3 className="font-display text-xl font-bold text-ink">{t("agents.emptyTitle")}</h3><p className="mt-1 text-sm text-ink-muted">{t("agents.emptyBody")}</p></div><Link className="rounded-control border border-primary-outline px-5 py-3 text-sm font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href="/signup">{t("agents.register")}</Link></div>}
      </section>
    </div>
  );
}
