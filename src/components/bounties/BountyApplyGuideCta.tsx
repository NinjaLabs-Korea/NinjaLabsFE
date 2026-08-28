"use client";

import Link from "next/link";

import { useAuthSnapshot } from "@/components/auth/FoundationProvider";
import { Badge } from "@/components/ui/Badge";

export function BountyApplyAuthBadge() {
  const auth = useAuthSnapshot();

  if (auth.status === "loading") return <Badge variant="neutral">Authentication: Checking</Badge>;
  if (auth.status === "signed-in") return <Badge variant="success">Authentication: Signed in</Badge>;
  return <Badge variant="danger">Authentication: Login required</Badge>;
}

export function BountyApplyGuideCta({ bountyHref }: { bountyHref: string }) {
  const auth = useAuthSnapshot();
  const label = auth.status === "signed-in"
    ? "Apply now"
    : auth.status === "signed-out"
      ? "View bounty and sign in"
      : "View bounty";

  return (
    <Link
      className="mt-5 inline-flex w-fit rounded-control bg-primary px-5 py-3 text-sm font-semibold text-on-inverse hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      href={bountyHref}
    >
      {label}
    </Link>
  );
}
