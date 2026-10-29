"use client";

import { useLinkStatus } from "next/link";
import { Link, usePathname } from "@/i18n/navigation";

type NavLink = {
  href: string;
  label: string;
};

type NavLinksProps = {
  links: NavLink[];
  variant: "desktop" | "mobile";
};

/**
 * Render as a child of a `Link`: while that link's navigation is pending, shows a 2px bar at the top of the viewport.
 * Links outside the viewport (closed mobile menu, `/about`) are not prefetched by default, so without this a click shows
 * nothing until the route arrives. The 120 ms delay lives in `animate-nav-progress`, so fast navigations never flash.
 */
export function NavPendingBar() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-primary animate-nav-progress motion-reduce:animate-none"
    />
  );
}

export function NavLinks({ links, variant }: NavLinksProps) {
  const pathname = usePathname();
  const isDesktop = variant === "desktop";

  return (
    <>
      {links.map(({ href, label }) => {
        const isActive = pathname === href || pathname.startsWith(`${href}/`);
        // One color per state: two `text-*` utilities on the same element are decided by stylesheet order, not by
        // class order, and `text-ink-secondary` is emitted after `text-ink`, so the active color would never apply.
        const focus = "motion-control motion-press hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
        const className = isDesktop
          ? `text-sm ${isActive ? "font-semibold text-ink" : "font-medium text-ink-secondary"} ${focus}`
          : `rounded-control px-3 py-2 text-sm ${isActive ? "bg-primary-soft font-semibold text-primary-strong" : "font-medium text-ink-secondary"} ${focus}`;

        return (
          <Link aria-current={isActive ? "page" : undefined} className={className} href={href} key={href} prefetch={true}>
            {label}
            <NavPendingBar />
          </Link>
        );
      })}
    </>
  );
}
