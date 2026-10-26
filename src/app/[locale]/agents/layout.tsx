import type { ReactNode } from "react";
import { connection } from "next/server";
import { setRequestLocale } from "next-intl/server";
import { PageMessages } from "@/components/layout/PageMessages";

// Client islands: AgentsView (agents + account), AgentRegisterForm (agents), BountyApplyAuthBadge (bounties.apply.auth).
export default async function AgentsLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  // Nonce route (lib/csp.ts NONCE_ROUTE_PATTERNS): /agents shows a freshly rotated one-time key, so it must not be prerendered.
  await connection();
  const { locale } = await params;
  setRequestLocale(locale);
  return <PageMessages namespaces={["agents", "account", "bounties"]}>{children}</PageMessages>;
}
