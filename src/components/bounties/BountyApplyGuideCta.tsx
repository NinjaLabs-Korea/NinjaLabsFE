"use client";

import { useTranslations } from "next-intl";

import { useAuthSnapshot } from "@/components/auth/FoundationProvider";
import { Badge } from "@/components/ui/Badge";
import { Link } from "@/i18n/navigation";

export function BountyApplyAuthBadge() {
  const auth = useAuthSnapshot();
  const t = useTranslations("bounties.apply.auth");

  if (auth.status === "loading") return <Badge variant="neutral">{t("checking")}</Badge>;
  if (auth.status === "signed-in") return <Badge variant="success">{t("signedIn")}</Badge>;
  return <Badge variant="danger">{t("loginRequired")}</Badge>;
}

export function BountyApplyGuideCta({ bountyHref }: { bountyHref: string }) {
  const auth = useAuthSnapshot();
  const t = useTranslations("bounties.apply.cta");
  const label = auth.status === "signed-in"
    ? t("applyNow")
    : auth.status === "signed-out"
      ? t("viewAndSignIn")
      : t("view");

  return (
    <Link
      className="mt-5 inline-flex w-fit rounded-control bg-primary px-5 py-3 text-sm font-semibold text-on-inverse hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      href={bountyHref}
    >
      {label}
    </Link>
  );
}
