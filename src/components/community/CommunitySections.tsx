import { AboutSection } from "@/components/community/AboutSection";
import { AchievementsSection } from "@/components/community/AchievementsSection";
import { ActivitiesSection } from "@/components/community/ActivitiesSection";
import { BountiesEntrySection } from "@/components/community/BountiesEntrySection";
import { MembersPreviewSection } from "@/components/community/MembersPreviewSection";
import { UpcomingEventsSection } from "@/components/community/UpcomingEventsSection";
import { RecruitmentBanner } from "@/components/recruit/RecruitmentBanner";
import type { CommunityData } from "@/lib/community";
import type { Bounty } from "@/lib/types";

/**
 * The community hub's sections, one component for the hub (`/`) and `/about` so the two never drift apart, in this order:
 * ongoing/upcoming events (only when there are some) -> recruitment banner (only while a cohort accepts applications) ->
 * past activities -> member preview -> achievements -> the bounty entry (preview, or a single call to action when none is
 * open). The hub puts its hero in front; `/about` puts "About Ninja Labs" (`aboutLevel`, its `<h1>`) in front instead.
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
      <UpcomingEventsSection events={data.upcoming} />
      <RecruitmentBanner />
      <ActivitiesSection events={data.events} unavailable={data.unavailable.notices} />
      <MembersPreviewSection members={data.members} unavailable={data.unavailable.members} />
      <AchievementsSection hall={data.hall} locale={locale} unavailable={data.unavailable.hall} />
      <BountiesEntrySection bounties={openBounties} />
    </>
  );
}
