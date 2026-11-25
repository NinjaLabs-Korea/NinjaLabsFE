"use client";

import { useTranslations } from "next-intl";
import { useAuthSnapshot } from "@/components/auth/FoundationProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Link } from "@/i18n/navigation";

/** Greeting plus the profile summary: nickname, and the way to the public profile and the settings. */
export function HomeProfileCard() {
  const t = useTranslations("home");
  const snapshot = useAuthSnapshot();
  if (snapshot.status !== "signed-in") return null;
  const { user } = snapshot;
  return (
    <section className="mx-auto max-w-content px-gutter pt-16">
      <div className="flex flex-col gap-6 rounded-card border border-border bg-surface p-5 shadow-card sm:p-[21px] md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar avatarUrl={user.avatarUrl} initials={user.initials} sizeClass="size-14" sizes="56px" textClass="text-lg font-bold" />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{t("greeting.eyebrow")}</p>
            <h1 className="break-words font-display text-2xl text-ink sm:text-4xl">{t("greeting.title", { name: user.handle })}</h1>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row md:shrink-0">
          <Link
            className="rounded-control bg-primary px-[21px] py-3 text-center text-sm leading-[21px] font-semibold text-on-inverse hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            href={`/members/${user.profileSlug}`}
          >
            {t("profile.viewProfile")}
          </Link>
          <Link
            className="rounded-control border border-primary-outline px-[21px] py-3 text-center text-sm leading-[21px] font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            href="/account"
          >
            {t("profile.editProfile")}
          </Link>
        </div>
      </div>
    </section>
  );
}
