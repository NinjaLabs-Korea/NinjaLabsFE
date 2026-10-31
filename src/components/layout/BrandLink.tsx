import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";

/**
 * The brand logo link (header and footer): always the community hub (`/`), for everyone and in every session state (product decision: the hub is the
 * primary service and is never skipped). A signed-in user reaches their dashboard through "My activity" in the user menu.
 */
export function BrandLink({ label, className, children }: { label: string; className: string; children: ReactNode }) {
  return (
    <Link aria-label={label} className={className} href="/" prefetch={true}>
      {children}
    </Link>
  );
}
