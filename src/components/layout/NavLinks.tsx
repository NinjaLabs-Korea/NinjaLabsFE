"use client";

import { Link, usePathname } from "@/i18n/navigation";

type NavLink = {
  href: string;
  label: string;
};

type NavLinksProps = {
  links: NavLink[];
  variant: "desktop" | "mobile";
};

export function NavLinks({ links, variant }: NavLinksProps) {
  const pathname = usePathname();
  const isDesktop = variant === "desktop";

  return (
    <>
      {links.map(({ href, label }) => {
        const isActive = pathname === href || pathname.startsWith(`${href}/`);
        // One color per state: two `text-*` utilities on the same element are decided by stylesheet order, not by
        // class order, and `text-ink-secondary` is emitted after `text-ink`, so the active color would never apply.
        const focus = "hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
        const className = isDesktop
          ? `text-sm ${isActive ? "font-semibold text-ink" : "font-medium text-ink-secondary"} ${focus}`
          : `rounded-control px-3 py-2 text-sm ${isActive ? "bg-primary-soft font-semibold text-primary-strong" : "font-medium text-ink-secondary"} ${focus}`;

        return (
          <Link aria-current={isActive ? "page" : undefined} className={className} href={href} key={href} prefetch={true}>
            {label}
          </Link>
        );
      })}
    </>
  );
}
