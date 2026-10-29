import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { NoticeFilters } from "@/components/notices/NoticeFilters";
import { CommunitySectionState } from "@/components/community/CommunitySectionState";
import { settle } from "@/lib/api/public";
import { getRuntimeNotices } from "@/lib/notices";
import { noticeCategoryFromQuery } from "@/lib/notice-categories";
import { localeMetadata } from "@/i18n/alternates";


export async function generateMetadata({ params }: PageProps<"/[locale]/notices">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "notices.metadata" });
  return localeMetadata(locale, "/notices", { title: t("title"), description: t("description") });
}

export default async function NoticesPage({ params, searchParams }: PageProps<"/[locale]/notices">) {
  const { locale } = await params;
  const { category } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("notices.list");
  const tCommunity = await getTranslations("community");
  const { value: notices, unavailable } = await settle(getRuntimeNotices(), []);

  return (
    <div className="mx-auto max-w-content px-6 py-16 pb-20">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-[768px]">
          <h1 className="font-display text-4xl tracking-[-0.36px] sm:text-5xl sm:tracking-[-0.48px] text-ink">{t("heading")}</h1>
          <p className="mt-4 text-lg text-ink-muted">
            {t("description")}
          </p>
        </div>
      </section>

      <div className="mt-8">
        {unavailable ? (
          <CommunitySectionState body={tCommunity("pageUnavailable")} retryLabel={tCommunity("retry")} />
        ) : (
          <NoticeFilters initialCategory={noticeCategoryFromQuery(category)} notices={notices} />
        )}
      </div>
    </div>
  );
}
