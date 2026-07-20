import Link from "next/link";

import type { Member } from "@/lib/types";

type MemberCardProps = { member: Member };

const contextualLink = (member: Member) => {
  const entries = Object.entries(member.links).filter(([key]) => key !== "profile");
  const [label, href] = entries[0] ?? [];
  return label && href ? { label: `${label[0].toUpperCase()}${label.slice(1)}`, href } : null;
};

export function MemberCard({ member }: MemberCardProps) {
  const contextual = contextualLink(member);
  return (
    <article className="overflow-hidden rounded-card border border-border bg-surface shadow-card">
      <div className="aspect-[16/9] bg-gradient-to-br from-primary-soft-border to-surface-subtle">
        {member.slug === "ara" ? (
          <div className="flex h-full items-center justify-center">
            <span className="flex size-24 items-center justify-center rounded-full bg-primary-soft-border font-display text-2xl text-primary">{member.initials}</span>
          </div>
        ) : null}
      </div>
      <div className="p-5">
        <h2 className="font-display text-xl font-bold text-ink">{member.name}</h2>
        <p className="mt-1 text-sm font-semibold text-primary">{member.role} · {member.title}</p>
        <p className="mt-3 text-sm text-ink-muted">{member.bio}</p>
        <div className="mt-4 flex gap-4 text-sm font-semibold text-primary">
          {member.links.profile ? <Link className="hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href={member.links.profile}>Profile</Link> : null}
          {contextual ? <Link className="hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href={contextual.href}>{contextual.label}</Link> : null}
        </div>
      </div>
    </article>
  );
}
