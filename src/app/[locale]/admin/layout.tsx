import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";
import { AdminGate } from "@/components/admin/AdminGate";
import { PageMessages } from "@/components/layout/PageMessages";

// Every admin island (AdminGate, AdminTabs, managers, toasts) reads admin.*; the shell provider ships common only.
export default async function AdminLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <PageMessages namespaces={["admin"]}>
      <AdminGate>{children}</AdminGate>
    </PageMessages>
  );
}
