import type { ReactNode } from "react";

import { AboutSection } from "@/components/community/AboutSection";
import { AchievementsSection } from "@/components/community/AchievementsSection";
import { ActivitiesSection } from "@/components/community/ActivitiesSection";
import { MembersPreviewSection } from "@/components/community/MembersPreviewSection";
import { NewsSection } from "@/components/community/NewsSection";
import { RecruitmentBanner } from "@/components/recruit/RecruitmentBanner";
import type { CommunityData } from "@/lib/community";

/**
 * The community face of the site, one component for the Intro (`/`) and `/about` so the two never drift apart:
 * About -> recruitment banner (only while a cohort accepts applications) -> `children` (the Intro puts its bounty preview
 * here) -> past activities -> latest news -> recent achievements -> member preview.
 */
export function CommunitySections({
  data,
  locale,
  aboutLevel = 2,
  children,
}: {
  data: CommunityData;
  locale: string;
  aboutLevel?: 1 | 2;
  children?: ReactNode;
}) {
  return (
    <>
      <AboutSection level={aboutLevel} />
      <RecruitmentBanner />
      {children}
      <ActivitiesSection events={data.events} unavailable={data.unavailable.notices} />
      <NewsSection news={data.news} unavailable={data.unavailable.notices} />
      <AchievementsSection hall={data.hall} locale={locale} unavailable={data.unavailable.hall} />
      <MembersPreviewSection members={data.members} unavailable={data.unavailable.members} />
    </>
  );
}
