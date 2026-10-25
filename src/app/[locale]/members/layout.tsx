import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";
import { PageMessages } from "@/components/layout/PageMessages";

// Client island: MemberFilters (+ MemberCard) reads members.*.
export default async function MembersLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PageMessages namespaces={["members"]}>{children}</PageMessages>;
}
