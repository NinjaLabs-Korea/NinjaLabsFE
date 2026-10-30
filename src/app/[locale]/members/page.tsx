import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MemberFilters } from "@/components/members/MemberFilters";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { CommunitySectionState } from "@/components/community/CommunitySectionState";
import { settle } from "@/lib/api/public";
import { getRuntimeMembers } from "@/lib/members";
import { localeMetadata } from "@/i18n/alternates";

export async function generateMetadata({ params }: PageProps<"/[locale]/members">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "members.metadata" });
  return localeMetadata(locale, "/members", { title: t("title"), description: t("description") });
}

export default async function MembersPage({ params }: PageProps<"/[locale]/members">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("members.list");
  const tCommunity = await getTranslations("community");
  const { value: members, unavailable } = await settle(getRuntimeMembers(), []);
  return (
    <div className="mx-auto max-w-content px-6 py-16 pb-20">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <SectionHeader eyebrow={t("eyebrow")} heading={t("heading")} level={1} size="xl" />
          <p className="mt-4 max-w-[768px] text-lg text-ink-muted">{t("description")}</p>
        </div>
      </div>
      <div className="mt-8">
        {unavailable ? (
          <CommunitySectionState body={tCommunity("pageUnavailable")} retryLabel={tCommunity("retry")} />
        ) : (
          <MemberFilters members={members} />
        )}
      </div>
    </div>
  );
}
