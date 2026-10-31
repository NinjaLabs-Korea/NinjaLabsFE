import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { AdminToastHost } from "@/components/admin/AdminToastHost";
import { OperationsConsole } from "@/components/admin/OperationsConsole";
import { getAdminBounties } from "@/lib/admin";
import { loadFromRuntime } from "@/lib/api/public";
import { localeAlternates } from "@/i18n/alternates";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/operations">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.operations" });
  return {
    alternates: localeAlternates(locale, "/admin/operations"),
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function AdminOperationsPage({ params }: PageProps<"/[locale]/admin/operations">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.operations");
  const tCommon = await getTranslations("admin.common");
  const bounties = await loadFromRuntime({ mock: getAdminBounties, api: async () => [] });

  return (
    <section className="mx-auto max-w-content px-gutter py-16 pb-20">
      <OperationsConsole bounties={bounties} tabs={<div className="mt-6"><AdminTabs active="operations" /></div>}>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{tCommon("eyebrow")}</p>
          <h1 className="mt-2 font-display text-4xl -tracking-[0.36px] sm:text-5xl sm:-tracking-[0.48px] text-ink">{t("title")}</h1>
          <p className="mt-4 max-w-[768px] text-lg text-ink-muted">{t("description")}</p>
        </div>
      </OperationsConsole>
      <AdminToastHost />
    </section>
  );
}
