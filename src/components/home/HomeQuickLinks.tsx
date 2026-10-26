import { useTranslations } from "next-intl";

import { SectionHeader } from "@/components/ui/SectionHeader";
import { Link } from "@/i18n/navigation";

// Keys under messages `home.quickLinks.items`.
const links = [
  { key: "bounties", href: "/bounties" },
  { key: "applications", href: "/applications" },
  { key: "agents", href: "/agents" },
  { key: "hallOfFame", href: "/hall-of-fame" },
  { key: "members", href: "/members" },
  { key: "about", href: "/about" },
] as const;

/** Shortcuts to the places a member goes most. */
export function HomeQuickLinks() {
  const t = useTranslations("home.quickLinks");
  return (
    <section className="mx-auto max-w-content px-4 py-16 sm:px-6">
      <SectionHeader eyebrow={t("eyebrow")} heading={t("heading")} level={2} size="lg" />
      <ul className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((link) => (
          <li key={link.key}>
            <Link
              className="block h-full rounded-card border border-border bg-surface p-5 shadow-card hover:shadow-frame focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              href={link.href}
            >
              <span className="font-display text-lg font-bold text-ink">{t(`items.${link.key}.title`)}</span>
              <span className="mt-1 block text-sm text-ink-muted">{t(`items.${link.key}.description`)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
