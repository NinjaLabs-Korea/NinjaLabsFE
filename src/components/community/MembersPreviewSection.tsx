import { useTranslations } from "next-intl";

import { CommunitySectionState } from "@/components/community/CommunitySectionState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Link } from "@/i18n/navigation";
import type { Member } from "@/lib/types";

/** "멤버 미리보기": the first official members as compact tiles linking to their public profile. */
export function MembersPreviewSection({ members, unavailable }: { members: Member[]; unavailable: boolean }) {
  const t = useTranslations("community.members");
  const tMembers = useTranslations("members");
  return (
    <section className="mx-auto max-w-content px-4 pb-16 sm:px-6">
      <SectionHeader eyebrow={t("eyebrow")} heading={t("heading")} level={2} size="lg" action={{ label: t("viewAll"), href: "/members" }} />
      {unavailable ? (
        <CommunitySectionState title={t("unavailable")} body={t("unavailableBody")} />
      ) : members.length === 0 ? (
        <CommunitySectionState body={t("empty")} />
      ) : (
        <ul className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {members.map((member) => (
            <li key={member.slug}>
              <Link
                className="flex h-full min-w-0 items-center gap-4 rounded-card border border-border bg-surface p-5 shadow-card hover:shadow-frame focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                href={member.links.profile ?? `/members/${member.slug}`}
              >
                <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-full bg-primary-soft-border font-display text-base font-bold text-primary">{member.initials}</span>
                <span className="min-w-0">
                  <span className="block break-words font-display text-base font-bold text-ink">{member.name}</span>
                  <span className="block text-sm font-semibold text-primary">{tMembers(`roles.${member.role.toLowerCase()}`)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
