import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminToastHost } from "@/components/admin/AdminToastHost";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { PostManager } from "@/components/admin/PostManager";
import { getAdminPosts } from "@/lib/admin";
import { loadFromRuntime } from "@/lib/api/public";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin/notices">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.notices" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function AdminNoticesPage({ params }: PageProps<"/[locale]/admin/notices">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.notices");
  const tCommon = await getTranslations("admin.common");
  const posts = await loadFromRuntime({ mock: getAdminPosts, api: async () => [] });

  return (
    <section className="mx-auto max-w-content px-6 py-16 pb-20">
      <PostManager posts={posts} tabs={<div className="mt-8"><AdminTabs active="notices" /></div>}>
        <div className="max-w-[768px]">
          <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{tCommon("eyebrow")}</p>
          <h1 className="font-display text-5xl tracking-[-0.48px] text-ink">{t("title")}</h1>
          <p className="mt-4 text-lg text-ink-muted">
            {t("description")}
          </p>
        </div>
      </PostManager>
      <AdminToastHost />
    </section>
  );
}
