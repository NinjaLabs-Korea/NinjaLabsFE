import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";
import { PageMessages } from "@/components/layout/PageMessages";

// Client island: AccountSettingsView (account).
export default async function AccountLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PageMessages namespaces={["account"]}>{children}</PageMessages>;
}
