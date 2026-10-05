import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { AdminToastHost } from "@/components/admin/AdminToastHost";
import { UserDirectory } from "@/components/admin/UserDirectory";
import { Badge } from "@/components/ui/Badge";
import { getAdminUsers } from "@/lib/admin";
import { loadRuntimeConfig } from "@/lib/runtime/config";
export async function generateMetadata({ params }: PageProps<"/[locale]/admin/users">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.users" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function AdminUsersPage({ params }: PageProps<"/[locale]/admin/users">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.users");
  const tCommon = await getTranslations("admin.common");
  const users = loadRuntimeConfig().runtimeMode === "mock" ? getAdminUsers() : [];

  return (
    <section className="mx-auto max-w-content px-6 py-16 pb-20">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{t("eyebrow")}</p>
          <h1 className="mt-2 font-display text-5xl -tracking-[0.48px] text-ink">{t("title")}</h1>
          <p className="mt-4 max-w-[768px] text-lg text-ink-muted">{t("description")}</p>
        </div>
        <Badge variant="neutral">{tCommon("adminOnly")}</Badge>
      </div>

      <div className="mt-6">
        <AdminTabs active="users" />
      </div>

      <UserDirectory users={users} />
      <AdminToastHost />

    </section>
  );
}
