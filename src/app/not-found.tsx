import { inter, spaceGrotesk } from "@/components/layout/fonts";
import { getTranslations } from "next-intl/server";
import { ClientIntlProvider } from "@/components/layout/ClientIntlProvider";
import { getNotFoundCopy } from "@/components/layout/NotFoundSection";
import { RootNotFoundCopy } from "@/components/layout/RootNotFoundCopy";
import { type Locale, routing } from "@/i18n/routing";
import "./globals.css";

// Root not-found (`/_not-found`): only paths outside the `[locale]` routes reach it (proxy-excluded files such as
// `/logo.svg` or `/ko/missing.png`) - in-locale misses are rewritten by `src/proxy.ts` to the static, localized
// `[locale]/page-not-found` page. This component is part of EVERY page's render (it is the root not-found boundary), so
// it must stay fully static: never call `headers()`, `getLocale()`, `setRequestLocale()` or a locale-less next-intl API
// (`useTranslations`/`getTranslations()` without a locale, the server `NextIntlClientProvider`, the shell Header/Footer)
// here or in app/layout.tsx - one request-time read turns every route dynamic. It renders a minimal English document
// and `RootNotFoundCopy` swaps the copy, `<html lang>` and the title to the URL's locale after hydration.
export default async function RootNotFound() {
  const entries = await Promise.all(
    routing.locales.map(async (locale) => {
      const t = await getTranslations({ locale, namespace: "common.notFound" });
      return [locale, { ...(await getNotFoundCopy(locale)), metaTitle: t("metaTitle") }] as const;
    }),
  );
  const copies = Object.fromEntries(entries) as Record<Locale, (typeof entries)[number][1]>;

  return (
    <html className={`${inter.variable} ${spaceGrotesk.variable}`} lang="en">
      <body className="bg-page text-ink font-sans antialiased min-h-dvh flex flex-col">
        {/* not-found.tsx cannot export metadata; React hoists this <title> into <head>. */}
        <title>{copies[routing.defaultLocale].metaTitle}</title>
        <ClientIntlProvider locale={routing.defaultLocale} messages={{}} timeZone="UTC">
          <main className="flex-1" id="main-content">
            <RootNotFoundCopy copies={copies} />
          </main>
        </ClientIntlProvider>
      </body>
    </html>
  );
}
