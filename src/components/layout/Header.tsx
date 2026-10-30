import Image from "next/image";
import { useTranslations } from "next-intl";
import { AuthArea } from "@/components/layout/AuthArea";
import { BrandLink } from "@/components/layout/BrandLink";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";
import { MobileMenu } from "@/components/layout/MobileMenu";
import { NAV_DESKTOP_ONLY_FLEX } from "@/components/layout/nav-breakpoint";
import { NavLinks } from "@/components/layout/NavLinks";

const navigation = [
  { href: "/about", key: "about" },
  { href: "/members", key: "members" },
  { href: "/hall-of-fame", key: "hallOfFame" },
  { href: "/notices", key: "notices" },
  { href: "/bounties", key: "bounties" },
  { href: "/recruit", key: "recruit" },
] as const;

export function Header() {
  const t = useTranslations("common.header");
  const tNav = useTranslations("common.nav");
  const links = navigation.map(({ href, key }) => ({ href, label: tNav(key) }));

  return (
    <header className="sticky top-0 z-50 h-16 border-b border-border bg-surface/85 backdrop-blur-[6px]">
      <div className="mx-auto grid h-full max-w-content grid-cols-[1fr_auto_1fr] items-center px-6">
        <BrandLink className="relative inline-flex min-h-11 items-center gap-2 justify-self-start after:absolute after:inset-y-0 after:-inset-x-[6px] after:content-['']" label={t("homeLabel")}>
          <Image
            src="/brand/ninja-labs-mascot.svg"
            alt=""
            width={33}
            height={28}
          />
          <span className="hidden whitespace-nowrap font-display text-xl font-bold text-ink sm:inline">Ninja Labs</span>
        </BrandLink>

        <nav className={`col-start-2 gap-7 ${NAV_DESKTOP_ONLY_FLEX}`} aria-label={t("mainNavigation")}>
          <NavLinks links={links} variant="desktop" />
        </nav>

        <div className="col-start-3 flex items-center gap-1 justify-self-end sm:gap-2">
          <LocaleSwitcher />
          <AuthArea variant="desktop" />

          <MobileMenu label={t("menu")}>
            <nav
              className="absolute right-0 top-full z-50 mt-2 flex max-h-[calc(100dvh-4.5rem)] w-44 flex-col gap-1 overflow-y-auto overscroll-contain rounded-tile border border-border bg-surface p-2 shadow-card"
              aria-label={t("mobileNavigation")}
            >
              <NavLinks links={links} variant="mobile" />
              <AuthArea variant="mobile" />
            </nav>
          </MobileMenu>
        </div>
      </div>
    </header>
  );
}
