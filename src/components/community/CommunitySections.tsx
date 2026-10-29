import { AboutSection } from "@/components/community/AboutSection";
import { AchievementsSection } from "@/components/community/AchievementsSection";
import { ActivitiesSection } from "@/components/community/ActivitiesSection";
import { MembersPreviewSection } from "@/components/community/MembersPreviewSection";
import { OpenBountiesSection } from "@/components/community/OpenBountiesSection";
import { RecruitmentBanner } from "@/components/recruit/RecruitmentBanner";
import type { CommunityData } from "@/lib/community";
import type { Bounty } from "@/lib/types";

/**
 * The community face of the site, one component for the Intro (`/`) and `/about` so the two never drift apart, in this order:
 * past activities -> member preview -> achievements -> open bounties (only when there are some) -> recruitment banner (only
 * while a cohort accepts applications). `/about` puts "About Ninja Labs" (`aboutLevel`, its `<h1>`) in front; the Intro has a
 * hero instead, so it passes no `aboutLevel`.
 */
export function CommunitySections({
  data,
  locale,
  aboutLevel,
  openBounties = [],
}: {
  data: CommunityData;
  locale: string;
  aboutLevel?: 1 | 2;
  openBounties?: Bounty[];
}) {
  return (
    <>
      {aboutLevel ? <AboutSection level={aboutLevel} /> : null}
      <ActivitiesSection events={data.events} unavailable={data.unavailable.notices} />
      <MembersPreviewSection members={data.members} unavailable={data.unavailable.members} />
      <AchievementsSection hall={data.hall} locale={locale} unavailable={data.unavailable.hall} />
      <OpenBountiesSection bounties={openBounties} />
      <RecruitmentBanner />
    </>
  );
}
