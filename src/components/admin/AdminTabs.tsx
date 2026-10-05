import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

const tabs = [
  { active: "users", href: "/admin/users", labelKey: "users" },
  { active: "bounties", href: "/admin/bounties", labelKey: "bounties" },
  { active: "hall-of-fame", href: "/admin/hall-of-fame", labelKey: "hallOfFame" },
  { active: "notices", href: "/admin/notices", labelKey: "notices" },
] as const;

type AdminTab = (typeof tabs)[number]["active"];

export function AdminTabs({ active }: { active: AdminTab }) {
  const t = useTranslations("admin.tabs");

  return (
    <nav className="flex flex-wrap gap-2 h-auto min-h-[66px] items-center rounded-card border border-border bg-surface p-[21px] shadow-card">
      {tabs.map((tab) => (
        <Link
          className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold ${tab.active === active ? "bg-primary text-primary-soft" : "bg-primary-soft text-primary-strong"}`}
          href={tab.href}
          key={tab.active}
        >
          {t(tab.labelKey)}
        </Link>
      ))}
    </nav>
  );
}
