import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CONTACT_EMAIL } from "@/lib/contact";

const platformLinks = [
  { href: "/bounties", key: "bounties" },
  { href: "/hall-of-fame", key: "hallOfFame" },
  { href: "/notices", key: "notices" },
] as const;

// Official links from the Ninja Labs Korea Notion hub (injective.notion.site/ninjalabskr).
// Ninja Labs has no Discord of its own; the Discord link is Injective's.

const ninjaLabsLinks = (contributorLabel: string) => [
  { href: "https://x.com/NinjaLabsKR", label: "X (@NinjaLabsKR)" },
  { href: "https://t.me/NinjaLabsKR", label: "Telegram (@NinjaLabsKR)" },
  { href: "https://t.me/+Nsy2KjGWtOE5NTY9", label: "Ninja Builders (Telegram)" },
  { href: "https://tally.so/r/3E7XZA", label: contributorLabel },
];

const injectiveLinks = [
  { href: "https://injective.com/", label: "Injective.com" },
  { href: "https://x.com/InjectiveKR", label: "X (@InjectiveKR)" },
  { href: "https://t.me/Injective_Korea", label: "Telegram (@Injective_Korea)" },
  { href: "https://discord.com/invite/injective", label: "Discord" },
  { href: "https://injhub.com/ecosystem/", label: "Ecosystem" },
];

export function Footer() {
  const t = useTranslations("common.footer");
  const tNav = useTranslations("common.nav");

  return (
    <footer className="bg-inverse-surface text-on-inverse">
      <div className="mx-auto max-w-content px-6 pt-12">
        <div className="flex flex-col justify-between gap-10 md:flex-row">
          <div>
            <Image
              src="/brand/ninja-labs-kr-logo.png"
              alt="Ninja Labs KR"
              width={370}
              height={86}
              className="h-[34px] w-auto"
            />
            <p className="mt-3 max-w-[287px] text-sm text-on-inverse-muted">
              {t("tagline")}
            </p>
          </div>

          <div className="flex flex-col gap-8 sm:flex-row sm:gap-12">
            <FooterLinkColumn
              heading={t("platform")}
              links={platformLinks.map(({ href, key }) => ({ href, label: tNav(key) }))}
            />
            <FooterLinkColumn heading={t("community")} links={ninjaLabsLinks(t("contributor"))} external />
            <FooterLinkColumn heading="Injective" links={injectiveLinks} external />
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-on-inverse/8 pt-[25px] pb-12 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-4 text-on-inverse-muted">
            {t("legal")}
          </p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-4 text-on-inverse-muted">
            <Link className="text-on-inverse-secondary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href="/privacy">
              {t("privacy")}
            </Link>
            <Link className="text-on-inverse-secondary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href="/terms">
              {t("terms")}
            </Link>
            <span>
              {t("contact")}{" "}
              <a className="text-on-inverse-secondary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterLinkColumn({
  heading,
  links,
  external = false,
}: {
  heading: string;
  links: { href: string; label: string }[];
  external?: boolean;
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-on-inverse/90">{heading}</h2>
      <ul className="mt-2 space-y-2 text-sm leading-5">
        {links.map(({ href, label }) => (
          <li key={label}>
            {external ? (
              <a
                className="text-sm text-on-inverse-secondary"
                href={href}
                target="_blank"
                rel="noreferrer"
              >
                {label}
              </a>
            ) : (
              <Link className="text-sm text-on-inverse-secondary" href={href}>
                {label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
