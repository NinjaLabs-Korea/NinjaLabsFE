import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { StartLink } from "@/components/auth/StartLink";
import { HeroSecondaryCta } from "@/components/community/HeroSecondaryCta";
import { Badge } from "@/components/ui/Badge";
import { HeroSurface } from "@/components/ui/HeroSurface";
import { HeroTitle } from "@/components/ui/HeroTitle";

// Keys under messages `community.about.roles`.
const roles = ["developer", "marketer", "researcher", "creator"] as const;

/**
 * The Intro (`/`) hero: Ninja Labs as a community. Eyebrow, headline and the intro paragraph, "Get started" (follows the auth
 * state, `lib/auth-route.ts`) and "Apply to join {cohort}" (only while a cohort accepts applications; otherwise a link to the
 * past activities). The visual is the four roles the community is for, not a mock-up. Needs the `recruit` client namespace.
 */
export async function CommunityHero() {
  const t = await getTranslations("landing.hero");
  const tAbout = await getTranslations("community.about");
  const tUser = await getTranslations("common.userMenu");
  return (
    <HeroSurface
      aside={
        <div className="rounded-card border border-on-inverse/12 bg-on-inverse/6 p-5 shadow-card backdrop-blur-[4px]">
          <p className="text-sm font-semibold text-on-inverse">{t("rolesTitle")}</p>
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {roles.map((role) => (
              <li key={role} className="min-w-0 rounded-tile border border-on-inverse/12 bg-on-inverse/6 p-4">
                <p className="break-words font-display text-base font-bold text-on-inverse">{tAbout(`roles.${role}.title`)}</p>
                <p className="mt-1 break-words text-sm text-on-inverse/75">{tAbout(`roles.${role}.description`)}</p>
              </li>
            ))}
          </ul>
        </div>
      }
    >
      <div className="self-start">
        <Badge variant="inverse">
          <Image src="/figma/injective-icon-white.svg" alt="" width={13} height={13} className="mr-1.5" />
          {t("eyebrow")}
        </Badge>
      </div>
      <HeroTitle highlight={t("titleHighlight")}>{t("title")}</HeroTitle>
      <p className="mt-6 max-w-[524px] text-lg text-on-inverse/75">{t("description")}</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <StartLink
          className="rounded-control bg-primary px-[29px] py-[15px] text-center text-base font-semibold text-on-inverse hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          memberLabel={tUser("myProfile")}
          resumeLabel={t("continueSignup")}
          signUpLabel={t("getStarted")}
        />
        <HeroSecondaryCta
          className="rounded-control border border-on-inverse/20 bg-on-inverse/8 px-[29px] py-[15px] text-center text-base font-semibold text-primary-soft hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          fallbackHref="/notices?category=events"
          fallbackLabel={t("exploreActivities")}
        />
      </div>
    </HeroSurface>
  );
}
