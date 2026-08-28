"use client";

import Link from "next/link";

import { useAuthSnapshot } from "@/components/auth/FoundationProvider";
import { Badge } from "@/components/ui/Badge";

export function BountyApplyAuthBadge() {
  const auth = useAuthSnapshot();

  if (auth.status === "loading") return <Badge variant="neutral">Checking login</Badge>;
  if (auth.status === "signed-in") return <Badge variant="success">Signed in</Badge>;
  return <Badge variant="danger">Login required</Badge>;
}

export function BountyApplyGuideCta({ bountyHref }: { bountyHref?: string }) {
  const auth = useAuthSnapshot();
  const href = bountyHref ?? "/bounties";
  const label = !bountyHref
    ? "Browse open bounties"
    : auth.status === "signed-in"
      ? "Apply now"
      : auth.status === "signed-out"
        ? "View bounty and sign in"
        : "View bounty";

  return (
    <>
      <Link
        className="mt-5 inline-flex w-fit rounded-control bg-primary px-5 py-3 text-sm font-semibold text-on-inverse hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        href={href}
      >
        {label}
      </Link>
      {!bountyHref ? (
        <p className="mt-3 text-sm text-ink-muted">There are no application bounties open right now.</p>
      ) : null}
    </>
  );
}
