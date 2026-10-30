import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AboutSection } from "@/components/community/AboutSection";
import { InitialCohortProvider } from "@/components/recruit/useCurrentCohort";
import { RecruitView } from "@/components/recruit/RecruitView";
import { getRuntimeCurrentCohort } from "@/lib/cohorts-public";
import { localeMetadata } from "@/i18n/alternates";

export async function generateMetadata({ params }: PageProps<"/[locale]/recruit">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "recruit.metadata" });
  return localeMetadata(locale, "/recruit", { title: t("title"), description: t("description") });
}

/**
 * Public and static (ISR): the open cohort is read on the server with a short revalidate and seeds the first paint, then re-read in the
 * browser together with the viewer's own application (`RecruitView`), so the page itself needs no request-time data and a visitor can read what Ninja Labs is before signing in.
 */
export default async function RecruitPage({ params }: PageProps<"/[locale]/recruit">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("recruit.hero");
  const cohort = await getRuntimeCurrentCohort();
  return (
    <>
      <section className="mx-auto max-w-content px-6 pt-16">
        <div>
          <div className="max-w-[768px]">
            <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{t("eyebrow")}</p>
            <h1 className="font-display text-4xl tracking-[-0.36px] sm:text-5xl sm:tracking-[-0.48px] text-ink">{t("heading")}</h1>
            <p className="mt-4 text-lg text-ink-muted">{t("description")}</p>
          </div>
        </div>
      </section>
      <div className="mt-10">
        <InitialCohortProvider cohort={cohort}>
          <RecruitView aboutSlot={<AboutSection />} />
        </InitialCohortProvider>
      </div>
    </>
  );
}
