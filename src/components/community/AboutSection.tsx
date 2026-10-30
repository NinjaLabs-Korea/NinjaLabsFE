import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/Badge";
import { SectionHeader } from "@/components/ui/SectionHeader";

// Keys under messages `community.about.roles`.
const roles = ["developer", "marketer", "researcher", "creator"] as const;

/** "About Ninja Labs": who the community is for. Shared by the Intro (`/`) and `/about`. `level` is 2 under a hero, 1 on its own page. */
export function AboutSection({ level = 2 }: { level?: 1 | 2 }) {
  const t = useTranslations("community.about");
  return (
    <section className="mx-auto max-w-content px-gutter py-16">
      <SectionHeader eyebrow={t("eyebrow")} heading={t("heading")} level={level} size={level === 1 ? "xl" : "lg"} />
      <p className="mt-4 max-w-[768px] text-lg text-ink-muted">{t("body")}</p>
      <ul className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {roles.map((role) => (
          <li key={role} className="rounded-card border border-border bg-surface p-5 shadow-card">
            <Badge>{t(`roles.${role}.title`)}</Badge>
            <p className="mt-3 text-sm text-ink-muted">{t(`roles.${role}.description`)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
