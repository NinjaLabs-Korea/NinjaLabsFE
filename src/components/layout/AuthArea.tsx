"use client";

import { useTranslations } from "next-intl";
import { useAuthActions, useAuthSnapshot } from "@/components/auth/FoundationProvider";
import { getAccountNavigationItems, UserMenu } from "@/components/layout/UserMenu";
import { Link } from "@/i18n/navigation";

type AuthAreaProps = {
  variant: "desktop" | "mobile";
};

export function AuthArea({ variant }: AuthAreaProps) {
  const t = useTranslations("common.header");
  const tMenu = useTranslations("common.userMenu");
  const snapshot = useAuthSnapshot();
  const { signOut } = useAuthActions();
  const user = snapshot.status === "signed-in" ? snapshot.user : null;

  if (variant === "desktop") {
    return (
      <>
        <Link
          className="hidden rounded-control px-[21px] py-3 text-sm leading-[21px] font-semibold text-ink-secondary md:inline-block"
          href="/bounties"
          prefetch={true}
        >
          {t("browse")}
        </Link>
        {user ? (
          <div className="hidden md:block">
            <UserMenu />
          </div>
        ) : (
          <Link
            className="rounded-control bg-primary px-[21px] py-3 text-sm leading-[21px] font-semibold text-on-inverse"
            href="/signup"
          >
            {t("getStarted")}
          </Link>
        )}
      </>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="mt-1 border-t border-border pt-2">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="grid size-8 place-items-center rounded-full bg-primary-soft-border font-display text-[13px] font-bold text-primary-strong">
          {user.initials}
        </span>
        <span className="text-sm font-semibold text-ink">{user.handle}</span>
      </div>
      <nav aria-label={tMenu("accountNavigation")} className="space-y-1 px-1 pb-1">
        {getAccountNavigationItems(user).map((item) => (
          <Link
            className="block rounded-control px-3 py-2 text-sm font-medium text-ink-secondary hover:bg-surface-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            href={item.href}
            key={item.key}
          >
            {tMenu(item.key)}
          </Link>
        ))}
      </nav>
      <button
        className="w-full rounded-control px-3 py-2 text-left text-sm font-semibold text-danger hover:bg-danger-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        onClick={() => void signOut()}
        type="button"
      >
        {tMenu("signOut")}
      </button>
    </div>
  );
}
