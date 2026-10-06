"use client";

import { useTranslations } from "next-intl";
import { useAuthActions, useAuthSnapshot, useFoundationMode } from "@/components/auth/FoundationProvider";
import { menuItemClass, menuPanelClass, useMenuButton } from "@/components/layout/useMenuButton";
import { Link } from "@/i18n/navigation";
import type { ClientUser } from "@/lib/contracts/auth";

// `key` is a message key under `common.userMenu`.
export function getAccountNavigationItems(user: Pick<ClientUser, "profileSlug">) {
  return [
    { key: "myProfile", href: `/members/${user.profileSlug}` },
    { key: "myApplications", href: "/applications" },
    { key: "myAgents", href: "/agents" },
  ] as const;
}

export function UserMenu() {
  const t = useTranslations("common.userMenu");
  const snapshot = useAuthSnapshot();
  const mode = useFoundationMode();
  const { signOut } = useAuthActions();
  const user = snapshot.status === "signed-in" ? snapshot.user : null;
  const menuItems = user ? getAccountNavigationItems(user) : [];
  // Account links + sign out.
  const menu = useMenuButton(menuItems.length + 1);

  if (!user) {
    return null;
  }

  return (
    <div className="relative" {...menu.rootProps}>
      <button
        {...menu.buttonProps()}
        className={`flex items-center gap-2.5 rounded-full border bg-surface py-1 pl-1 pr-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary${menu.open ? " border-primary-outline" : " border-border"}`}
      >
        <span className="grid size-8 place-items-center rounded-full bg-primary-soft-border font-display text-[13px] font-bold text-primary-strong">
          {user.initials}
        </span>
        <span className="text-sm font-semibold text-ink">{user.handle}</span>
        <span aria-hidden="true" className="text-xs text-ink-muted">{menu.open ? "▴" : "▾"}</span>
      </button>

      {menu.open ? (
        <div className={`${menuPanelClass} w-56`} {...menu.menuProps}>
          <div className="border-b border-border px-3 pt-2.5 pb-2">
            <p className="text-sm font-semibold text-ink">{user.handle}</p>
            {user.walletAddress ? (
              <p className="whitespace-nowrap text-xs text-ink-muted" title={user.walletAddress}>
                <span className="sr-only">{t("walletAddress", { wallet: user.walletAddress })}</span>
                <span aria-hidden="true">
                  {user.walletAddress.length > 12
                    ? `${user.walletAddress.slice(0, 6)}…${user.walletAddress.slice(-4)}`
                    : user.walletAddress}
                </span>
              </p>
            ) : null}
            {mode === "mock" ? <p className="text-xs text-ink-muted">{t("sessionPreview")}</p> : null}
          </div>
          <div className="pt-1.5">
            {menuItems.map((item, index) => (
              <Link
                {...menu.itemProps(index)}
                className={menuItemClass}
                href={item.href}
                key={item.key}
                onClick={() => menu.closeMenu()}
                role="menuitem"
              >
                {t(item.key)}
              </Link>
            ))}
            <div className="my-1.5 border-t border-border" />
            <button
              {...menu.itemProps(menuItems.length)}
              className="w-full rounded-control px-3 py-2 text-left text-sm font-semibold text-danger hover:bg-danger-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              onClick={() => {
                void signOut();
                menu.closeMenu();
              }}
              role="menuitem"
              type="button"
            >
              {t("signOut")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
