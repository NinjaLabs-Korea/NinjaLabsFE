import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";
import { PageMessages } from "@/components/layout/PageMessages";

// Client islands under /bounties: BountyFilters/BountyCard, BountyApplyGuideCta, BountyActionPanel (bounties) and BountyAgentPanel (agents.panel).
export default async function BountiesLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PageMessages namespaces={["bounties", "agents"]}>{children}</PageMessages>;
}
