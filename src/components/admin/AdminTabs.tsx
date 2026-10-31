import { useTranslations } from "next-intl";
import { NavPendingBar } from "@/components/layout/NavLinks";
import { Link } from "@/i18n/navigation";

const tabs = [
  { active: "users", href: "/admin/users", labelKey: "users" },
  { active: "bounties", href: "/admin/bounties", labelKey: "bounties" },
  { active: "operations", href: "/admin/operations", labelKey: "operations" },
  { active: "nft-jobs", href: "/admin/nft-jobs", labelKey: "nftJobs" },
  { active: "recruitment", href: "/admin/recruitment", labelKey: "recruitment" },
  { active: "hall-of-fame", href: "/admin/hall-of-fame", labelKey: "hallOfFame" },
  { active: "notices", href: "/admin/notices", labelKey: "notices" },
  { active: "audit", href: "/admin/audit", labelKey: "audit" },
] as const;

type AdminTab = (typeof tabs)[number]["active"];

export function AdminTabs({ active }: { active: AdminTab }) {
  const t = useTranslations("admin.tabs");

  return (
    <nav aria-label={t("ariaLabel")} className="flex flex-wrap gap-2 h-auto min-h-[66px] items-center rounded-card border border-border bg-surface p-[21px] shadow-card">
      {tabs.map((tab) => (
        <Link
          // The active tab was conveyed by color alone; expose it to assistive tech too.
          aria-current={tab.active === active ? "page" : undefined}
          className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs max-sm:h-10 max-sm:px-4 font-semibold motion-control motion-press ${tab.active === active ? "bg-primary text-primary-soft" : "bg-primary-soft text-primary-strong"}`}
          href={tab.href}
          key={tab.active}
        >
          {t(tab.labelKey)}
          <NavPendingBar />
        </Link>
      ))}
    </nav>
  );
}
