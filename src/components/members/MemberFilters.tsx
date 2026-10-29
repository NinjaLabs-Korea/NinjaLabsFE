"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { MemberCard } from "@/components/cards/MemberCard";
import { Badge } from "@/components/ui/Badge";
import type { Member } from "@/lib/types";

type MemberFiltersProps = { members: Member[] };
type RoleFilter = "All" | Member["role"];
const roles: Member["role"][] = ["Core", "Dev", "Design", "Ops"];

export function MemberFilters({ members }: MemberFiltersProps) {
  const t = useTranslations("members");
  const [role, setRole] = useState<RoleFilter>("All");
  const resetFilters = () => {
    setRole("All");
  };
  const visibleMembers = useMemo(() => members.filter((member) => role === "All" || member.role === role), [members, role]);

  return (
    <>
      <div className="flex flex-wrap gap-2" aria-label={t("filters.ariaLabel")} role="group">
        <button aria-pressed={role === "All"} className="motion-control motion-press max-sm:inline-flex max-sm:min-h-10 max-sm:items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={() => setRole("All")} type="button"><Badge variant={role === "All" ? "selected" : "primary-soft"}>{t("filters.all")}</Badge></button>
        {roles.map((item) => <button aria-pressed={role === item} className="motion-control motion-press max-sm:inline-flex max-sm:min-h-10 max-sm:items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" key={item} onClick={() => setRole(item)} type="button"><Badge variant={role === item ? "selected" : "primary-soft"}>{t(`roles.${item.toLowerCase()}`)}</Badge></button>)}
      </div>
      {visibleMembers.length > 0 ? (
        <section className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4 animate-fade-in motion-reduce:animate-none" aria-label={t("filters.listAriaLabel")} key={role}>
          {visibleMembers.map((member) => <MemberCard key={member.slug} member={member} />)}
        </section>
      ) : members.length === 0 ? (
        // The feed itself is empty (nothing published yet): there is no filter to reset.
        <div className="mt-8 rounded-tile border border-dashed border-border-dashed bg-surface-subtle p-10 text-center" role="status">
          <p className="text-sm font-semibold text-ink">{t("filters.feedEmptyTitle")}</p>
          <p className="mt-1 text-sm text-ink-muted">{t("filters.feedEmptyBody")}</p>
        </div>
      ) : (
        <div className="mt-8 rounded-tile border border-dashed border-border-dashed bg-surface-subtle p-10 text-center">
          <p className="text-sm font-semibold text-ink">{t("filters.emptyTitle")}</p>
          <p className="mt-1 text-sm text-ink-muted">{t("filters.emptyBody")}</p>
          <button
            className="mt-4 rounded-control border border-primary-outline px-4 py-2 max-sm:py-2.5 text-sm font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            onClick={resetFilters}
            type="button"
          >
            {t("filters.reset")}
          </button>
        </div>
      )}
    </>
  );
}
