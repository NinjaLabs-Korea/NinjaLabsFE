"use client";

import type { ReactNode } from "react";
import { useAuthSnapshot } from "@/components/auth/FoundationProvider";
import { Link } from "@/i18n/navigation";
import { resolveBrandHref } from "@/lib/auth-route";

/**
 * The header logo: the Intro (`/`) for visitors, the signed-in home (`/home`) for a user who finished onboarding
 * (`lib/auth-route.ts resolveBrandHref`). Server render and the session restore both show the Intro target.
 */
export function BrandLink({ label, className, children }: { label: string; className: string; children: ReactNode }) {
  const href = resolveBrandHref(useAuthSnapshot());
  return (
    <Link aria-label={label} className={className} href={href} prefetch={true}>
      {children}
    </Link>
  );
}
