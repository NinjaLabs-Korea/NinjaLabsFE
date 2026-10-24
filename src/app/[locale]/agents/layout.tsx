import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";
import { PageMessages } from "@/components/layout/PageMessages";

// Client islands: AgentsView (agents + account), AgentRegisterForm (agents), BountyApplyAuthBadge (bounties.apply.auth).
export default async function AgentsLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PageMessages namespaces={["agents", "account", "bounties"]}>{children}</PageMessages>;
}
