import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";
import { PageMessages } from "@/components/layout/PageMessages";

// Client islands: HomeGate / profile card / activity / recruitment (home), the status labels of My applications (account), the cohort cards (recruit).
export default async function HomeLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PageMessages namespaces={["home", "account", "recruit"]}>{children}</PageMessages>;
}
