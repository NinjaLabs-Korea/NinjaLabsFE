import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MemberFilters } from "@/components/members/MemberFilters";
import { Badge } from "@/components/ui/Badge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Link } from "@/i18n/navigation";
import { getRuntimeMembers } from "@/lib/members";

// Keys under messages `members.list.rules`.
const rules = ["registration", "adminEnables", "memberEdits", "unassign"];

export async function generateMetadata({ params }: PageProps<"/[locale]/members">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "members.metadata" });
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function MembersPage({ params }: PageProps<"/[locale]/members">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("members.list");
  const members = await getRuntimeMembers();
  return (
    <div className="mx-auto max-w-content px-6 py-16 pb-20">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <SectionHeader eyebrow={t("eyebrow")} heading={t("heading")} level={1} size="xl" />
          <p className="mt-4 max-w-[768px] text-lg text-ink-muted">{t("description")}</p>
        </div>
        <Badge variant="success">{t("public")}</Badge>
      </div>
      <MemberFilters members={members} />
      <section className="mt-16 rounded-card border border-border bg-surface p-5 shadow-card">
        <h2 className="font-display text-2xl text-ink">{t("howItWorks")}</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {rules.map((rule) => <p key={rule} className="rounded-control bg-surface-subtle p-3 text-sm text-ink-muted">{t(`rules.${rule}`)}</p>)}
          <Link className="rounded-control bg-surface-subtle p-3 text-sm font-semibold text-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href={members[0] ? `/members/${members[0].slug}` : "/signup"}>{members[0] ? t("viewProfile") : t("becomeFirst")}</Link>
        </div>
      </section>
    </div>
  );
}
