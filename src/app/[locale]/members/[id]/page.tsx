import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { Badge } from "@/components/ui/Badge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Link } from "@/i18n/navigation";
import { decodeDetailId, validateDetailId } from "@/lib/detail-id";
import { getRuntimeProfile, payoutBadge } from "@/lib/members";
import { localeMetadata } from "@/i18n/alternates";

type MemberProfilePageProps = PageProps<"/[locale]/members/[id]">;

const nftTileClass = "rounded-tile bg-[linear-gradient(135deg,var(--color-nft-deep)_0%,var(--color-hero-to)_55%,var(--color-accent-soft)_100%)] shadow-nft";
const mascotTileClass = "flex size-14 items-center justify-center rounded-tile";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: MemberProfilePageProps): Promise<Metadata> {
  const { locale, id: rawId } = await params;
  const id = decodeDetailId(rawId);
  const t = await getTranslations({ locale, namespace: "members.profile" });
  const profile = (await validateDetailId("members", id)) ? await getRuntimeProfile(id, locale) : undefined;

  if (!profile) {
    return { alternates: {}, title: t("notFoundTitle") };
  }

  // The BE looks nicknames up case-insensitively: canonicalize to the stored spelling so /members/JAEMIN and
  // /members/jaemin are one indexed page, not duplicates.
  return localeMetadata(locale, `/members/${profile.slug}`, { title: t("pageTitle", { handle: profile.handle }), description: profile.bio });
}

export default async function MemberProfilePage({ params }: MemberProfilePageProps) {
  const { locale, id: rawId } = await params;
  const id = decodeDetailId(rawId);
  setRequestLocale(locale);
  const t = await getTranslations("members.profile");
  const tRoles = await getTranslations("members.roles");
  const format = await getFormatter();
  // Shape check before the fetch (api: nickname, mock: slug); the layout already did it, this keeps the page self-contained.
  if (!(await validateDetailId("members", id))) notFound();
  const profile = await getRuntimeProfile(id, locale);
  if (!profile) notFound();
  const completed = profile.completions.length > 0;
  const completionNfts = profile.nfts.filter((nft) => nft.type === "completion");

  return (
    <div className="mx-auto max-w-content px-gutter py-16 pb-20">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-5 rounded-card border border-border bg-surface p-[21px] shadow-card sm:flex-row sm:items-center sm:gap-6">
          <div className="flex size-24 shrink-0 items-center justify-center rounded-full bg-primary-soft-border font-display text-[30px] text-primary">{profile.initials}</div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {profile.skills.map((skill) => <Badge key={skill}>{t(`categories.${skill.toLowerCase()}`)}</Badge>)}
              {profile.teamRole ? <Badge variant="selected">{t("teamBadge", { role: tRoles(profile.teamRole.toLowerCase()) })}</Badge> : null}
              {completed || !profile.teamRole ? <Badge variant={completed ? "success" : "neutral"}>{completed ? t("bountiesCompleted", { count: profile.completions.length }) : t("newBuilder")}</Badge> : null}
            </div>
            <h1 className="mt-3 break-words font-display text-4xl -tracking-[0.36px] text-ink sm:text-5xl sm:-tracking-[0.48px]">{profile.handle}</h1>
            <p className="mt-3 max-w-[768px] whitespace-pre-line break-words text-base text-ink-muted">{profile.bio}</p>
          </div>
        </div>
      </section>

      <section className="mt-10 rounded-panel bg-[linear-gradient(160deg,var(--color-hero-from)_0%,var(--color-hero-via)_55%,var(--color-hero-to)_100%)] p-6 text-on-inverse shadow-frame sm:p-10">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-5 lg:items-center">
          <div className="lg:col-span-2">
            <Badge variant="inverse">
              <Image alt="" className="mr-1.5 size-3.5 rounded-full" height={14} src="/figma/ninja-labs-mascot.png" width={14} />
              {t("portfolio.eyebrow")}
            </Badge>
            <h2 className="mt-4 font-display text-4xl">{completed ? t("portfolio.headingCompleted") : t("portfolio.headingEmpty")}</h2>
            <p className="mt-4 text-base text-on-inverse/70">{completed ? t("portfolio.bodyCompleted") : t("portfolio.bodyEmpty")}</p>
          </div>
          <div className="rounded-card border border-on-inverse/15 bg-on-inverse/10 p-[21px] backdrop-blur-sm lg:col-span-3">
            <div className="flex items-center gap-3">
              <Image alt="" className="size-12 shrink-0 rounded-full" height={48} src="/figma/ninja-labs-mascot.png" width={48} />
              <div className="min-w-0">
                <p className="break-words text-base font-semibold">{profile.handle}</p>
                <p className="text-sm text-on-inverse/75">{t("portfolio.memberSince", { date: profile.joinedAt })}</p>
              </div>
            </div>
            {completionNfts.length ? (
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {completionNfts.map((nft) => (
                  <div key={nft.id} className={`relative flex aspect-square flex-col overflow-hidden p-3 ${nftTileClass}`} title={[nft.tokenId ? t("portfolio.token", { id: nft.tokenId }) : null, nft.mintTxHash ? t("portfolio.tx", { hash: nft.mintTxHash }) : null].filter(Boolean).join(" · ") || undefined}>
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,var(--color-on-inverse)_0%,transparent_60%)] opacity-35" />
                    {nft.status !== "ATTACHED" ? <span className="relative text-xs text-on-inverse/70">{t(`nftStatus.${nft.status}`)}</span> : null}
                    <span className="relative mt-auto break-words text-xs font-semibold [text-shadow:var(--shadow-tile-text)]">{nft.title || t("portfolio.untitledNft")}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 flex min-h-72 flex-col items-center justify-center rounded-card border border-dashed border-on-inverse/25 bg-on-inverse/5 p-6 text-center">
                <span className={`${mascotTileClass} bg-on-inverse`}><Image alt="" height={36} src="/figma/ninja-labs-mascot.png" width={36} /></span>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="py-14">
        <SectionHeader
          eyebrow={t("history.eyebrow")}
          heading={completed ? t("history.heading") : t("history.headingEmpty")}
          action={completed ? { label: t("history.browseMore"), href: "/bounties" } : undefined}
        />
        {completed ? (
          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
            {profile.completions.slice(0, 3).map((completion) => {
              const badge = payoutBadge(completion.payoutStatus);
              return (
              <Link className="rounded-card border border-border bg-surface p-[21px] shadow-card hover:shadow-frame focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href={completion.bountySlug ? `/bounties/${completion.bountySlug}` : "/bounties"} key={`${completion.bountySlug ?? ""}:${completion.title}`}>
                <Badge>{t(`categories.${completion.category.toLowerCase()}`)}</Badge>
                <h3 className="mt-3 break-words font-display text-lg font-bold text-ink">{completion.title}</h3>
                <p className="mt-2 text-sm text-ink-muted">
                  {completion.reward
                    ? t("history.completedOn", { date: completion.completedAt, reward: `${format.number(completion.reward.amount, { maximumFractionDigits: 6 })} ${completion.reward.currency}${completion.moreRewards ? ` +${completion.moreRewards}` : ""}` })
                    : t("history.completedDate", { date: completion.completedAt })}
                </p>
                {badge ? <div className="mt-2"><Badge variant={badge.variant}>{t(badge.key)}</Badge></div> : null}
              </Link>
              );
            })}
          </div>
        ) : (
          <div className="mt-6 flex min-h-72 flex-col items-center justify-center rounded-card border border-dashed border-border-dashed bg-surface-subtle p-6 text-center">
            <span className={`${mascotTileClass} bg-primary-soft`}><Image alt="" height={36} src="/figma/ninja-labs-mascot.png" width={36} /></span>
            <h3 className="mt-4 font-display text-xl font-bold text-ink">{t("history.emptyTitle")}</h3>
            <p className="mt-2 max-w-xl text-sm text-ink-muted">{t("history.emptyBody")}</p>
          </div>
        )}
      </section>

      <section id="agents">
        <SectionHeader eyebrow={t("agents.eyebrow")} heading={t("agents.heading")} />
        {profile.agents.length ? (
          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
            {profile.agents.map((agent) => (
              <article key={agent.wallet} className="rounded-card border border-dashed border-border-dashed bg-surface p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="min-w-0 break-words font-display text-xl font-bold text-ink">{agent.name}</h3>
                  {agent.verified ? <Badge variant="success">{t("agents.verified")}</Badge> : null}
                </div>
                <p className="mt-3 break-all text-sm text-ink-muted">{t("agents.wallet", { wallet: agent.wallet })}</p>
                <p className="mt-3 text-base font-semibold text-ink">{t("agents.completed", { count: agent.completedBounties })}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-card border border-dashed border-border-dashed bg-surface p-6">
            <div>
              <h3 className="font-display text-xl font-bold text-ink">{t("agents.emptyTitle")}</h3>
              <p className="mt-1 text-sm text-ink-muted">{t("agents.emptyBody")}</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
