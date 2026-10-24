"use client";

import { useTranslations } from "next-intl";
import { useAuthSnapshot } from "@/components/auth/FoundationProvider";
import { Badge } from "@/components/ui/Badge";

/**
 * Bounty detail masthead badges (Figma 15 draws the signed-out pair). The server and hydration render with the
 * `loading` auth snapshot (see `useAuthSnapshot`), which keeps the signed-out copy, so the HTML never mismatches; once the
 * session is restored a signed-in visitor sees that actions are available instead of "Actions require login".
 */
export function BountyAccessBadges() {
  const t = useTranslations("bounties.detail");
  const signedIn = useAuthSnapshot().status === "signed-in";
  return (
    <div className="flex flex-wrap gap-2">
      {signedIn ? (
        <>
          <Badge variant="success">{t("signedInView")}</Badge>
          <Badge variant="primary-soft">{t("actionsAvailable")}</Badge>
        </>
      ) : (
        <>
          <Badge variant="success">{t("publicView")}</Badge>
          <Badge variant="danger">{t("actionsRequireLogin")}</Badge>
        </>
      )}
    </div>
  );
}
