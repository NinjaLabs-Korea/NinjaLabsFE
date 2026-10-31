"use client";

import { useTranslations } from "next-intl";
import { useAuthActions, useAuthSnapshot } from "@/components/auth/FoundationProvider";
import { NAV_DESKTOP_ONLY_BLOCK, NAV_DESKTOP_ONLY_FLEX, NAV_DESKTOP_ONLY_INLINE } from "@/components/layout/nav-breakpoint";
import { getAccountNavigationItems, userChipAvatarSizeClass, userChipBoxClass, UserMenu } from "@/components/layout/UserMenu";
import { Link } from "@/i18n/navigation";
import { useMemberHint, useSessionHint } from "@/lib/foundation/session-hint";

type AuthAreaProps = {
  variant: "desktop" | "mobile";
};

export function AuthArea({ variant }: AuthAreaProps) {
  const t = useTranslations("common.header");
  const tMenu = useTranslations("common.userMenu");
  const snapshot = useAuthSnapshot();
  const { signOut } = useAuthActions();
  const tabHadSession = useSessionHint();
  const likelyMember = useMemberHint();
  // Reserve the user chip box when this tab had a session (locale remount) or the browser's last session was a member
  // (reload, new tab), so the chip replaces a same-size box instead of shifting the header.
  const hadSession = tabHadSession || likelyMember;
  const user = snapshot.status === "signed-in" ? snapshot.user : null;

  if (variant === "desktop") {
    return (
      <>
        <Link
          className={`whitespace-nowrap rounded-control px-[21px] py-3 text-sm leading-[21px] font-semibold text-ink-secondary ${NAV_DESKTOP_ONLY_INLINE}`}
          href="/bounties"
          prefetch={true}
        >
          {t("browse")}
        </Link>
        {user ? (
          <div className={`animate-fade-in motion-reduce:animate-none ${NAV_DESKTOP_ONLY_BLOCK}`}>
            <UserMenu />
          </div>
        ) : snapshot.status === "loading" || (snapshot.status === "signed-out" && snapshot.reason === "unavailable") ? (
          // Session still being restored (or it could not be checked and the cookie is kept): keep the box, hide the
          // label, so a signed-in visitor never sees "Get started". This tab already had a signed-in session (locale
          // switch remount): reserve the user chip's box instead (same box classes as the trigger, 10rem wide) so nothing shifts.
          hadSession ? (
            <span aria-hidden="true" className={`invisible w-40 border-transparent ${NAV_DESKTOP_ONLY_FLEX} ${userChipBoxClass}`}>
              <span className={userChipAvatarSizeClass} />
            </span>
          ) : (
            <span aria-hidden="true" className="invisible whitespace-nowrap rounded-control px-4 py-3 text-sm leading-[21px] font-semibold sm:px-[21px]">
              {t("getStarted")}
            </span>
          )
        ) : (
          <Link
            className="animate-fade-in whitespace-nowrap rounded-control bg-primary px-4 py-3 text-sm leading-[21px] font-semibold text-on-inverse motion-reduce:animate-none sm:px-[21px]"
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
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft-border font-display text-[13px] font-bold text-primary-strong">
          {user.initials}
        </span>
        <span className="min-w-0 break-words text-sm font-semibold text-ink">{user.handle}</span>
      </div>
      <nav aria-label={tMenu("accountNavigation")} className="space-y-1 px-1 pb-1">
        {getAccountNavigationItems(user).map((item) => (
          <Link
            className="motion-control motion-press flex min-h-11 items-center rounded-control px-3 py-2.5 text-sm font-medium text-ink-secondary hover:bg-surface-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            href={item.href}
            key={item.key}
            prefetch={true}
          >
            {tMenu(item.key)}
          </Link>
        ))}
      </nav>
      <button
        className="flex min-h-11 w-full items-center rounded-control px-3 py-2.5 text-left text-sm font-semibold text-danger hover:bg-danger-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        onClick={() => void signOut()}
        type="button"
      >
        {tMenu("signOut")}
      </button>
    </div>
  );
}
