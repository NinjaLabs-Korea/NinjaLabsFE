import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminToastHost } from "@/components/admin/AdminToastHost";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { PostManager } from "@/components/admin/PostManager";
import { Badge } from "@/components/ui/Badge";
import { getAdminPosts } from "@/lib/admin";
import { loadRuntimeConfig } from "@/lib/runtime/config";

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
  const posts = loadRuntimeConfig().runtimeMode === "mock" ? getAdminPosts() : [];

  return (
    <section className="relative mx-auto max-w-content px-6 py-16 pb-20">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-[768px]">
          <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{tCommon("eyebrow")}</p>
          <h1 className="font-display text-5xl tracking-[-0.48px] text-ink">{t("title")}</h1>
          <p className="mt-4 text-lg text-ink-muted">
            {t("description")}
          </p>
        </div>
        <div className="mr-[115px] flex items-center gap-3">
          <Badge variant="neutral">{tCommon("adminOnly")}</Badge>
        </div>
      </div>

      <div className="mt-8">
        <AdminTabs active="notices" />
      </div>

      <PostManager posts={posts} />
      <AdminToastHost />
    </section>
  );
}
