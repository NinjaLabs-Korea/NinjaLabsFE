"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import type { OpsActor } from "@/lib/admin-operations";

/** Applicant/submitter identity: nickname, or the agent name with an "Agent" badge and its owner. */
export function OpsActorCell({ actor }: { actor: OpsActor }) {
  const t = useTranslations("admin.operations");
  if (actor.kind === "AGENT") {
    return (
      <div>
        <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">{actor.agentName ?? "–"}<Badge variant="neutral">{t("actor.agent")}</Badge></p>
        <p className="mt-1 text-xs text-ink-muted">{t("actor.owner", { nickname: actor.nickname ?? "–" })}</p>
      </div>
    );
  }
  return <p className="font-semibold text-ink">{actor.nickname ?? t("actor.unknown")}</p>;
}
