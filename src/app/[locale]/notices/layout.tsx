import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";
import { PageMessages } from "@/components/layout/PageMessages";

// Client island: NoticeFilters (+ NoticeRow) reads notices.*.
export default async function NoticesLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PageMessages namespaces={["notices"]}>{children}</PageMessages>;
}
