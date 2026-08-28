import Image from "next/image";
import Link from "next/link";

import { BountyCard } from "@/components/cards/BountyCard";
import { NewsCard } from "@/components/cards/NewsCard";
import { Badge } from "@/components/ui/Badge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getRuntimeLanding } from "@/lib/landing";

const trackRecord = "Own your track record.";

export default async function Home() {
  const { hero, bounties, news } = await getRuntimeLanding();
  const heroTitle = hero.title.replace(` ${trackRecord}`, "");

  return (
    <>
      <section className="relative isolate overflow-hidden bg-[linear-gradient(160deg,var(--color-hero-from)_0%,var(--color-hero-via)_55%,var(--color-hero-to)_100%)] lg:flex lg:min-h-[870px] lg:items-center">
        <div className="pointer-events-none absolute -right-1/4 -top-1/4 h-[680px] w-[680px] bg-[radial-gradient(circle,var(--color-glow)_0%,transparent_70%)] opacity-30" />
        <div className="relative mx-auto grid w-full max-w-content gap-12 px-4 py-28 sm:px-6 lg:grid-cols-2">
          <div className="flex flex-col justify-center">
            <div className="self-start">
              <Badge variant="inverse">
                <Image
                  src="/figma/injective-icon-white.svg"
                  alt=""
                  width={13}
                  height={13}
                  className="mr-1.5"
                />
                {hero.eyebrow}
              </Badge>
            </div>
            <h1 className="mt-5 max-w-[552px] font-display text-5xl -tracking-[0.6px] text-on-inverse sm:text-hero">
              {heroTitle}{" "}
              <span className="bg-[linear-gradient(90deg,var(--color-glow)_0%,var(--color-accent-soft)_55%,var(--color-primary-outline)_100%)] bg-clip-text text-transparent">
                {trackRecord}
              </span>
            </h1>
            <p className="mt-6 max-w-[524px] text-lg text-on-inverse/75">{hero.description}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                className="rounded-control bg-primary px-[29px] py-[15px] text-center text-base font-semibold text-on-inverse hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                href={hero.primaryCta.href}
              >
                {hero.primaryCta.label}
              </Link>
              <Link
                className="rounded-control border border-on-inverse/20 bg-on-inverse/8 px-[29px] py-[15px] text-center text-base font-semibold text-primary-soft hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                href={hero.secondaryCta.href}
              >
                {hero.secondaryCta.label}
              </Link>
            </div>
            <dl className="mt-12 flex flex-wrap gap-x-10 gap-y-5">
              {hero.stats.map((stat) => (
                <div key={stat.label}>
                  <dt className="font-display text-2xl font-bold text-on-inverse">{stat.value}</dt>
                  <dd className="text-sm text-on-inverse/50">{stat.label}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-card border border-on-inverse/12 bg-on-inverse/6 p-[21px] shadow-card backdrop-blur-[4px]">
            <div className="flex items-center gap-3">
              <Image
                src="/figma/ninja-labs-mascot.png"
                alt=""
                width={48}
                height={48}
                className="h-12 w-12 shrink-0 rounded-tile"
              />
              <div>
                <p className="text-base font-semibold text-on-inverse">{hero.portfolio.handle}</p>
                <p className="text-sm text-on-inverse/50">
                  Ninja NFT · member since {hero.portfolio.memberSince}
                </p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3">
              {hero.portfolio.completed.map((title) => (
                <div
                  key={title}
                  className="relative aspect-square overflow-hidden rounded-tile bg-[linear-gradient(135deg,var(--color-nft-deep)_0%,var(--color-hero-to)_55%,var(--color-accent-soft)_100%)] shadow-nft"
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,var(--color-on-inverse)_0%,transparent_60%)] opacity-35" />
                  <span className="absolute inset-x-2 bottom-2 text-xs font-semibold text-on-inverse [text-shadow:var(--shadow-tile-text)]">
                    {title}
                  </span>
                </div>
              ))}
              <div className="grid aspect-square place-items-center rounded-tile border border-dashed border-on-inverse/25 text-sm text-on-inverse/50">
                + next
              </div>
            </div>
            <p className="mt-4 text-center text-sm text-on-inverse/75">
              {hero.portfolio.totalCompleted} bounties completed · a growing on-chain portfolio
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-content px-4 py-16 sm:px-6">
        <SectionHeader
          eyebrow="Marketplace"
          heading="Active bounties"
          level={2}
          size="lg"
          action={{ label: "View all →", href: "/bounties" }}
        />
        <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          {bounties.map((bounty) => (
            <BountyCard key={bounty.slug} bounty={bounty} showSummary={false} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-content px-4 pb-20 sm:px-6">
        <SectionHeader
          eyebrow="From the community"
          heading="Recent news"
          level={2}
          size="lg"
          action={{ label: "View all →", href: "/notices" }}
        />
        <div className="mt-7 grid grid-cols-1 gap-5 lg:grid-cols-3">
          {news.map((notice) => (
            <NewsCard key={notice.slug} notice={notice} />
          ))}
        </div>
      </section>
    </>
  );
}
