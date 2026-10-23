import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import type { ReactNode } from "react";
import { type Namespace, pickMessages } from "@/i18n/messages";

/** Namespaces every page already receives from the `[locale]/layout.tsx` shell provider. */
export const shellNamespaces: readonly Namespace[] = ["common"];

/**
 * Server component: nested `NextIntlClientProvider` that ships only the namespaces a page's client islands read
 * (plus `common`). Without it a client component sees the shell messages only (`common`).
 */
export async function PageMessages({ namespaces, children }: { namespaces: readonly Namespace[]; children: ReactNode }) {
  const messages = await getMessages();
  return (
    <NextIntlClientProvider messages={pickMessages(messages, [...shellNamespaces, ...namespaces])}>
      {children}
    </NextIntlClientProvider>
  );
}
