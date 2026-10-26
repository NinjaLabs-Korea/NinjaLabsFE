import { NextIntlClientProvider, useLocale, useMessages, useTimeZone } from "next-intl";
import type { ReactNode } from "react";
import { shellNamespaces } from "@/components/layout/PageMessages";
import { type Namespace, pickMessages } from "@/i18n/messages";

/**
 * Synchronous twin of `layout/PageMessages` for a page body (a page that has no layout of its own to hold the provider, like the
 * Intro): the same nested `NextIntlClientProvider` with only the namespaces a client island reads. `PageMessages` stays the one for
 * layouts; this one can be rendered by tests and by sync server components because it uses the `useMessages` hook, not `await`.
 */
export function ClientMessages({ namespaces, children }: { namespaces: readonly Namespace[]; children: ReactNode }) {
  const messages = useMessages();
  // locale and time zone are passed on explicitly: a client-side render (tests) cannot infer them the way the server provider does.
  return (
    <NextIntlClientProvider locale={useLocale()} messages={pickMessages(messages, [...shellNamespaces, ...namespaces])} timeZone={useTimeZone()}>
      {children}
    </NextIntlClientProvider>
  );
}
