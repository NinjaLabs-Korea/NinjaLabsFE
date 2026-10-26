import type { Metadata } from "next";
import type { ReactNode } from "react";
import { connection } from "next/server";
import { setRequestLocale } from "next-intl/server";
import { AdminGate } from "@/components/admin/AdminGate";
import { PageMessages } from "@/components/layout/PageMessages";

// Operator-only (robots.ts disallows /<locale>/admin); noindex as a second line, like the account page: a disallowed URL that is linked can still be indexed.
export const metadata: Metadata = { robots: { index: false, follow: false } };

// Every admin island (AdminGate, AdminTabs, managers, toasts) reads admin.* (the recruitment console also reads the applicant form labels in recruit.*); the shell provider ships common only.
export default async function AdminLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  // Nonce route (lib/csp.ts NONCE_ROUTE_PATTERNS): the CSP nonce is per request, so this must not be prerendered.
  await connection();
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <PageMessages namespaces={["admin", "recruit"]}>
      <AdminGate>{children}</AdminGate>
    </PageMessages>
  );
}
