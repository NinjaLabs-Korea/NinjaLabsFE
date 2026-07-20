"use client";

import { useMemo, useState } from "react";

import { MemberCard } from "@/components/cards/MemberCard";
import { Badge } from "@/components/ui/Badge";
import type { Member } from "@/lib/types";

type MemberFiltersProps = { members: Member[] };
type RoleFilter = "All" | Member["role"];
const roles: Member["role"][] = ["Core", "Dev", "Design", "Ops"];

export function MemberFilters({ members }: MemberFiltersProps) {
  const [role, setRole] = useState<RoleFilter>("All");
  const resetFilters = () => {
    setRole("All");
  };
  const visibleMembers = useMemo(() => members.filter((member) => role === "All" || member.role === role), [members, role]);

  return (
    <>
      <div className="flex flex-wrap gap-2" aria-label="Member roles">
        <button className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={() => setRole("All")} type="button"><Badge variant={role === "All" ? "selected" : "primary-soft"}>All</Badge></button>
        {roles.map((item) => <button className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" key={item} onClick={() => setRole(item)} type="button"><Badge variant={role === item ? "selected" : "primary-soft"}>{item}</Badge></button>)}
      </div>
      {visibleMembers.length > 0 ? (
        <section className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4" aria-label="Members">
          {visibleMembers.map((member) => <MemberCard key={member.slug} member={member} />)}
        </section>
      ) : (
        <div className="mt-8 rounded-tile border border-dashed border-border-dashed bg-surface-subtle p-10 text-center">
          <p className="text-sm font-semibold text-ink">No members match your filters</p>
          <p className="mt-1 text-sm text-ink-muted">Try a different category or clear the search.</p>
          <button
            className="mt-4 rounded-control border border-primary-outline px-4 py-2 text-sm font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            onClick={resetFilters}
            type="button"
          >
            Reset filters
          </button>
        </div>
      )}
    </>
  );
}
