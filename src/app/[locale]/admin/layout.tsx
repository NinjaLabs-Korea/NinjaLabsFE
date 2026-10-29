import type { Metadata } from "next";
import type { ReactNode } from "react";
import { connection } from "next/server";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminGate } from "@/components/admin/AdminGate";
import { PageMessages } from "@/components/layout/PageMessages";

// Operator-only (robots.ts disallows /<locale>/admin); noindex as a second line, like the account page: a disallowed URL that is linked can still be indexed.
// The title is the admin landing page's ("Admin · Users | Ninja Labs": `/admin` redirects to `/admin/users`): a route under /admin that sets
// no title of its own (the bare `/admin` index, a gate screen shown before the page metadata is applied) would otherwise inherit the
// site-wide default. Every admin page overrides it with its own `metaTitle`, all in the one `Admin · <Page> | Ninja Labs` format.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.users" });
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

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
