"use client";

import { useTranslations } from "next-intl";
import { useAuthActions, useAuthSnapshot, useFoundationMode } from "@/components/auth/FoundationProvider";
import { menuItemClass, menuPanelClass, useMenuButton } from "@/components/layout/useMenuButton";
import { Link } from "@/i18n/navigation";
import { shortAddress } from "@/lib/format";
import type { ClientUser } from "@/lib/contracts/auth";

// `key` is a message key under `common.userMenu`.
export function getAccountNavigationItems(user: Pick<ClientUser, "profileSlug">) {
  return [
    { key: "myActivity", href: "/home" },
    { key: "myProfile", href: `/members/${user.profileSlug}` },
    { key: "myApplications", href: "/applications" },
    { key: "myAgents", href: "/agents" },
    { key: "accountSettings", href: "/account" },
  ] as const;
}

/** Box of the trigger chip (without colors); `AuthArea` reserves the same box while the session is restored. */
export const userChipBoxClass = "flex items-center gap-2.5 rounded-full border py-1 pl-1 pr-3";
export const userChipAvatarSizeClass = "size-8";

/**
 * Inside of the trigger chip: avatar initials, nickname, caret. The real trigger and the non-interactive hint chip
 * (`AuthArea`, painted from `useChipHint` while the session restores) both render it, so they look identical.
 */
export function UserChipContent({ initials, handle, open = false }: { initials: string; handle: string; open?: boolean }) {
  return (
    <>
      <span className={`grid ${userChipAvatarSizeClass} place-items-center rounded-full bg-primary-soft-border font-display text-[13px] font-bold text-primary-strong`}>
        {initials}
      </span>
      <span className="max-w-[9rem] truncate text-sm font-semibold text-ink">{handle}</span>
      <span aria-hidden="true" className={`text-xs text-ink-muted motion-control motion-reduce:transition-none${open ? " rotate-180" : ""}`}>▾</span>
    </>
  );
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
        className={`${userChipBoxClass} bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary${menu.open ? " border-primary-outline" : " border-border"}`}
      >
        <UserChipContent handle={user.handle} initials={user.initials} open={menu.open} />
      </button>

      {menu.open ? (
        <div aria-label={t("accountNavigation")} className={`${menuPanelClass} w-56`} {...menu.menuProps}>
          <div className="border-b border-border px-3 pt-2.5 pb-2">
            <p className="break-words text-sm font-semibold text-ink">{user.handle}</p>
            {user.walletAddress ? (
              <p className="whitespace-nowrap text-xs text-ink-muted" title={user.walletAddress}>
                <span className="sr-only">{t("walletAddress", { wallet: user.walletAddress })}</span>
                <span aria-hidden="true">
                  {shortAddress(user.walletAddress)}
                </span>
              </p>
            ) : null}
            {mode === "mock" ? <p className="text-xs text-ink-muted">{t("sessionPreview")}</p> : null}
          </div>
          <div className="pt-1.5">
            {menuItems.map((item, index) => (
              <Link
                key={item.key}
                {...menu.itemProps(index)}
                className={menuItemClass}
                href={item.href}
                onClick={() => menu.closeMenu()}
                role="menuitem"
              >
                {t(item.key)}
              </Link>
            ))}
            <div className="my-1.5 border-t border-border" />
            <button
              {...menu.itemProps(menuItems.length)}
              className="w-full motion-control rounded-control px-3 py-2 text-left text-sm font-semibold text-danger hover:bg-danger-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
