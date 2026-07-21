import Image from "next/image";
import Link from "next/link";
import { AuthArea } from "@/components/layout/AuthArea";
import { NavLinks } from "@/components/layout/NavLinks";

const navigation = [
  { href: "/bounties", label: "Bounties" },
  { href: "/hall-of-fame", label: "Hall of Fame" },
  { href: "/members", label: "Members" },
  { href: "/notices", label: "Notices" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 h-16 border-b border-border bg-surface/85 backdrop-blur-[6px]">
      <div className="mx-auto grid h-full max-w-content grid-cols-[1fr_auto_1fr] items-center px-6">
        <Link className="flex items-center gap-2 justify-self-start" href="/" aria-label="Ninja Labs home">
          <Image
            src="/figma/ninja-labs-mascot.png"
            alt=""
            width={28}
            height={28}
            className="rounded-logo"
          />
          <span className="font-display text-xl font-bold text-ink">Ninja Labs</span>
        </Link>

        <nav className="col-start-2 hidden gap-7 md:flex" aria-label="Main navigation">
          <NavLinks links={navigation} variant="desktop" />
        </nav>

        <div className="col-start-3 flex items-center gap-2 justify-self-end">
          <AuthArea variant="desktop" />

          <details className="relative md:hidden">
            <summary className="flex cursor-pointer list-none items-center rounded-control px-3 py-3 text-sm leading-[21px] font-semibold text-ink-secondary [&::-webkit-details-marker]:hidden">
              Menu
            </summary>
            <nav
              className="absolute right-0 top-full z-50 mt-2 flex w-44 flex-col gap-1 rounded-tile border border-border bg-surface p-2 shadow-card"
              aria-label="Mobile navigation"
            >
              <NavLinks links={navigation} variant="mobile" />
              <Link
                className="rounded-control px-3 py-2 text-sm font-semibold text-primary-strong"
                href="/bounties"
              >
                Browse
              </Link>
              <AuthArea variant="mobile" />
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
