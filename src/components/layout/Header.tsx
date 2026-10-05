import Image from "next/image";
import { useTranslations } from "next-intl";
import { AuthArea } from "@/components/layout/AuthArea";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";
import { NavLinks } from "@/components/layout/NavLinks";
import { Link } from "@/i18n/navigation";

const navigation = [
  { href: "/bounties", key: "bounties" },
  { href: "/hall-of-fame", key: "hallOfFame" },
  { href: "/members", key: "members" },
  { href: "/notices", key: "notices" },
] as const;

export function Header() {
  const t = useTranslations("common.header");
  const tNav = useTranslations("common.nav");
  const links = navigation.map(({ href, key }) => ({ href, label: tNav(key) }));

  return (
    <header className="sticky top-0 z-50 h-16 border-b border-border bg-surface/85 backdrop-blur-[6px]">
      <div className="mx-auto grid h-full max-w-content grid-cols-[1fr_auto_1fr] items-center px-6">
        <Link className="flex items-center gap-2 justify-self-start" href="/" aria-label={t("homeLabel")}>
          <Image
            src="/figma/ninja-labs-mascot.png"
            alt=""
            width={28}
            height={28}
            className="rounded-logo"
          />
          <span className="font-display text-xl font-bold text-ink">Ninja Labs</span>
        </Link>

        <nav className="col-start-2 hidden gap-7 md:flex" aria-label={t("mainNavigation")}>
          <NavLinks links={links} variant="desktop" />
        </nav>

        <div className="col-start-3 flex items-center gap-2 justify-self-end">
          <LocaleSwitcher />
          <AuthArea variant="desktop" />

          <details className="relative md:hidden">
            <summary className="flex cursor-pointer list-none items-center rounded-control px-3 py-3 text-sm leading-[21px] font-semibold text-ink-secondary [&::-webkit-details-marker]:hidden">
              {t("menu")}
            </summary>
            <nav
              className="absolute right-0 top-full z-50 mt-2 flex w-44 flex-col gap-1 rounded-tile border border-border bg-surface p-2 shadow-card"
              aria-label={t("mobileNavigation")}
            >
              <NavLinks links={links} variant="mobile" />
              <Link
                className="rounded-control px-3 py-2 text-sm font-semibold text-primary-strong"
                href="/bounties"
              >
                {t("browse")}
              </Link>
              <AuthArea variant="mobile" />
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
