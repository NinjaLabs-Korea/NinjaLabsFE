"use client";

import { useTranslations } from "next-intl";
import type { OpsActor } from "@/lib/admin-operations";

/** Applicant/submitter identity: the nickname (agents are gone; old agent rows are read as their owner). */
export function OpsActorCell({ actor }: { actor: OpsActor }) {
  const t = useTranslations("admin.operations");
  return <p className="font-semibold text-ink">{actor.nickname ?? t("actor.unknown")}</p>;
}
