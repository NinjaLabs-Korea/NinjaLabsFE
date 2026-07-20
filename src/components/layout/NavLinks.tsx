"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
        const className = isDesktop
          ? `text-sm font-medium text-ink-secondary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary${isActive ? " text-ink font-semibold" : ""}`
          : `rounded-control px-3 py-2 text-sm font-medium text-ink-secondary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary${isActive ? " bg-primary-soft text-primary-strong font-semibold" : ""}`;

        return (
          <Link aria-current={isActive ? "page" : undefined} className={className} href={href} key={href}>
            {label}
          </Link>
        );
      })}
    </>
  );
}
