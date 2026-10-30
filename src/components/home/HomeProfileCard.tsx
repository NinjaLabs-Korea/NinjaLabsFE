"use client";

import { useTranslations } from "next-intl";
import { useAuthSnapshot } from "@/components/auth/FoundationProvider";
import { Badge } from "@/components/ui/Badge";
import { Link } from "@/i18n/navigation";

/** `inj1ab…9k4d`: the same shape as `shortWalletAddress` in the wallet module, which is not imported here so the home does not load wagmi. */
const shortAddress = (address: string) => (address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address);

// BE parent-NFT statuses -> `home.profile.nft.<key>` and the badge color. Anything else reads as "pending" (never claims a mint).
const nftStates = {
  MINTED: { key: "minted", variant: "success" },
  ATTACHING: { key: "minted", variant: "success" },
  ATTACHED: { key: "minted", variant: "success" },
  PENDING: { key: "pending", variant: "warning" },
  MINTING: { key: "pending", variant: "warning" },
  FAILED: { key: "failed", variant: "danger" },
} as const;

/** Greeting plus the profile summary: nickname, wallet and Ninja NFT status, and the way to the public profile and the settings. */
export function HomeProfileCard() {
  const t = useTranslations("home");
  const snapshot = useAuthSnapshot();
  if (snapshot.status !== "signed-in") return null;
  const { user } = snapshot;
  const nft = user.nftStatus ? (nftStates[user.nftStatus as keyof typeof nftStates] ?? nftStates.PENDING) : null;
  return (
    <section className="mx-auto max-w-content px-gutter pt-16">
      <div className="flex flex-col gap-6 rounded-card border border-border bg-surface p-5 shadow-card sm:p-[21px] md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span aria-hidden="true" className="grid size-14 shrink-0 place-items-center rounded-full bg-primary-soft-border font-display text-lg font-bold text-primary-strong">{user.initials}</span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{t("greeting.eyebrow")}</p>
            <h1 className="break-words font-display text-2xl text-ink sm:text-4xl">{t("greeting.title", { name: user.handle })}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {user.walletAddress ? (
                <Badge variant="success">{t("profile.walletConnected", { address: shortAddress(user.walletAddress) })}</Badge>
              ) : (
                <Link className="inline-flex min-h-11 items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href="/account#wallet">
                  <Badge variant="warning">{t("profile.walletMissing")}</Badge>
                </Link>
              )}
              {nft ? <Badge variant={nft.variant}>{t(`profile.nft.${nft.key}`)}</Badge> : <Badge variant="neutral">{t("profile.nft.none")}</Badge>}
            </div>
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
