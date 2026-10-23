import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { HighlightManager } from "@/components/admin/HighlightManager";
import { AdminToastHost } from "@/components/admin/AdminToastHost";
import { Badge } from "@/components/ui/Badge";
import { getAdminHighlights } from "@/lib/admin";
import { loadFromRuntime } from "@/lib/api/public";
import { loadRuntimeHallOfFame } from "@/lib/hall-of-fame";


export async function generateMetadata({ params }: PageProps<"/[locale]/admin/hall-of-fame">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.hallOfFame" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function AdminHallOfFamePage({ params }: PageProps<"/[locale]/admin/hall-of-fame">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.hallOfFame");
  const tCommon = await getTranslations("admin.common");
  const tStats = await getTranslations("hallOfFame.stats");
  const tHall = await getTranslations("hallOfFame.unavailable");
  const highlights = await loadFromRuntime({ mock: getAdminHighlights, api: async () => [] });
  // Same unavailable wrapper as the public page: a BE outage renders a status panel instead of the error boundary.
  const { hallOfFame: hall, unavailable } = await loadRuntimeHallOfFame(locale);

  return (
    <section className="mx-auto max-w-content px-6 py-16 pb-20">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-[768px]">
          <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{tCommon("eyebrow")}</p>
          <h1 className="font-display text-5xl tracking-[-0.48px] text-ink">{t("title")}</h1>
          <p className="mt-4 text-lg text-ink-muted">
            {t("description")}
          </p>
        </div>
        <Badge variant="neutral">{tCommon("adminOnly")}</Badge>
      </div>

      <div className="mt-8">
        <AdminTabs active="hall-of-fame" />
      </div>

      <div className="mt-8 space-y-8">
        <section>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{t("statsEyebrow")}</p>
              <h2 className="font-display text-2xl tracking-[-0.24px] text-ink">{t("statsTitle")}</h2>
            </div>
            <Badge variant="neutral">{t("statsBadge")}</Badge>
          </div>
          {unavailable ? (
            <div className="mt-6 rounded-card border border-dashed border-border bg-surface-subtle p-6 text-center" role="status">
              <p className="font-display text-lg font-bold text-ink">{tHall("title")}</p>
              <p className="mt-1 text-sm text-ink-muted">{tHall("body")}</p>
            </div>
          ) : null}
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {hall.stats.map(({ value, labelKey }) => (
              <article key={labelKey} className="rounded-card border border-primary-soft-border bg-primary-soft p-5 text-center">
                <p className="font-display text-4xl font-bold text-primary">{value}</p>
                <p className="mt-2 text-sm text-ink-muted">{tStats(labelKey)}</p>
              </article>
            ))}
          </div>
        </section>

        <HighlightManager highlights={highlights} />
      </div>
      <AdminToastHost />
    </section>
  );
}
