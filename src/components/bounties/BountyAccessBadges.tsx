"use client";

import { useTranslations } from "next-intl";
import { useAuthSnapshot } from "@/components/auth/FoundationProvider";
import { Badge } from "@/components/ui/Badge";

/**
 * Bounty detail masthead badges (Figma 15 draws the signed-out pair). The server and hydration render with the
 * `loading` auth snapshot (see `useAuthSnapshot`), which keeps the signed-out copy, so the HTML never mismatches; once the
 * session is restored a signed-in visitor sees that actions are available instead of "Actions require login".
 */
export function BountyAccessBadges({ actionsOpen = true }: { /** The bounty still takes applications/submissions; a closed one claims no available actions. */ actionsOpen?: boolean } = {}) {
  const t = useTranslations("bounties.detail");
  const snapshot = useAuthSnapshot();
  const signedIn = snapshot.status === "signed-in";
  // The session could not be checked: neither "Public view / Actions require login" (visitor may be signed in) nor the signed-in pair is true.
  if (snapshot.status === "signed-out" && snapshot.reason === "unavailable") return null;
  return (
    <div className="flex flex-wrap gap-2">
      {signedIn ? (
        <>
          <Badge variant="success">{t("signedInView")}</Badge>
          {actionsOpen ? <Badge variant="primary-soft">{t("actionsAvailable")}</Badge> : null}
        </>
      ) : (
        <>
          <Badge variant="success">{t("publicView")}</Badge>
          {actionsOpen ? <Badge variant="danger">{t("actionsRequireLogin")}</Badge> : null}
        </>
      )}
    </div>
  );
}
