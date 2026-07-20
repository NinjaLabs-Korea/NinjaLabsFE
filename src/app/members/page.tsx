import type { Metadata } from "next";
import { MemberFilters } from "@/components/members/MemberFilters";
import { Badge } from "@/components/ui/Badge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getMembers, PROFILE_EMPTY_ID } from "@/lib/members";

const rules = [
  "Registration is shared.",
  "Admin enables is_member.",
  "Member edits bio.",
  "Unassign hides card but preserves profile.",
];

export const metadata: Metadata = {
  title: "Members — Ninja Labs",
  description: "Meet the builders and community members shaping Ninja Labs.",
};

export default function MembersPage() {
  return (
    <div className="mx-auto max-w-content px-6 py-16 pb-20">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <SectionHeader eyebrow="The people behind Ninja Labs" heading="Members" level={1} size="xl" />
          <p className="mt-4 max-w-[768px] text-lg text-ink-muted">Meet the builders and community members shaping Ninja Labs.</p>
        </div>
        <Badge variant="success">Public</Badge>
      </div>
      <MemberFilters members={getMembers()} />
      <section className="mt-16 rounded-card border border-border bg-surface p-5 shadow-card">
        <h2 className="font-display text-2xl text-ink">How membership works</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {rules.map((rule) => <p key={rule} className="rounded-control bg-surface-subtle p-3 text-sm text-ink-muted">{rule}</p>)}
          <a className="rounded-control bg-surface-subtle p-3 text-sm font-semibold text-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href={`/members/${PROFILE_EMPTY_ID}`}>View a new builder profile.</a>
        </div>
      </section>
    </div>
  );
}
