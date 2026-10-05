import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BountyManager } from "@/components/admin/BountyManager";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { AdminToastHost } from "@/components/admin/AdminToastHost";
import { getAdminBounties } from "@/lib/admin";
import { loadFromRuntime } from "@/lib/api/public";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/bounties">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.bounties" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function AdminBountiesPage({ params }: PageProps<"/[locale]/admin/bounties">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.bounties");
  const bounties = await loadFromRuntime({ mock: getAdminBounties, api: async () => [] });

  return (
    <section className="mx-auto max-w-content px-6 py-16 pb-20">
      <BountyManager bounties={bounties} tabs={<div className="mt-6"><AdminTabs active="bounties" /></div>}>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{t("eyebrow")}</p>
          <h1 className="mt-2 font-display text-5xl -tracking-[0.48px] text-ink">{t("title")}</h1>
          <p className="mt-4 max-w-[768px] text-lg text-ink-muted">{t("description")}</p>
        </div>
      </BountyManager>
      <AdminToastHost />
    </section>
  );
}
