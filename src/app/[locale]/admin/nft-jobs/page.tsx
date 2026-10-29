import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { AdminToastHost } from "@/components/admin/AdminToastHost";
import { NftJobsManager } from "@/components/admin/NftJobsManager";
import { localeAlternates } from "@/i18n/alternates";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/nft-jobs">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.nftJobs" });
  return {
    alternates: localeAlternates(locale, "/admin/nft-jobs"),
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function AdminNftJobsPage({ params }: PageProps<"/[locale]/admin/nft-jobs">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.nftJobs");
  const tCommon = await getTranslations("admin.common");

  return (
    <section className="mx-auto max-w-content px-6 py-16 pb-20">
      <NftJobsManager tabs={<div className="mt-6"><AdminTabs active="nft-jobs" /></div>}>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{tCommon("eyebrow")}</p>
          <h1 className="mt-2 font-display text-4xl -tracking-[0.36px] sm:text-5xl sm:-tracking-[0.48px] text-ink">{t("title")}</h1>
          <p className="mt-4 max-w-[768px] text-lg text-ink-muted">{t("description")}</p>
        </div>
      </NftJobsManager>
      <AdminToastHost />
    </section>
  );
}
