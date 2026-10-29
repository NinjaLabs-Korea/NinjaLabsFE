import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { Inter, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import { FoundationProvider } from "@/components/auth/FoundationProvider";
import { FlashToast } from "@/components/layout/FlashToast";
import { HomeHint } from "@/components/layout/HomeHint";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { shellNamespaces } from "@/components/layout/PageMessages";
import { pickMessages } from "@/i18n/messages";
import { type Locale, localeTags } from "@/i18n/routing";
import { previewUser } from "@/lib/mocks/fixtures";
import { composeFoundationRuntime } from "@/lib/runtime/config";
import "../../app/globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

const { foundationConfig } = composeFoundationRuntime(previewUser);

/**
 * The whole document: `<html lang>`, fonts, skip link, shell `NextIntlClientProvider` (`common` only) and
 * `FoundationProvider` around Header / main / Footer. Rendered by `app/[locale]/layout.tsx` for every page (after
 * `setRequestLocale`). Never render it from the root `app/not-found.tsx`: Header/Footer and the server intl provider
 * read the request locale, which would call `headers()` there and make every route dynamic.
 */
export async function AppShell({ locale, children }: { locale: Locale; children: ReactNode }) {
  const t = await getTranslations({ locale, namespace: "common.layout" });
  // The shell ships `common` only; pages add their own namespaces through `layout/PageMessages`.
  const shellMessages = pickMessages(await getMessages(), shellNamespaces);

  return (
    <html
      lang={localeTags[locale].htmlLang}
      className={`${inter.variable} ${spaceGrotesk.variable}`}
    >
      <body className="bg-page text-ink font-sans antialiased min-h-dvh flex flex-col">
        <a
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-control focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-on-inverse"
          href="#main-content"
        >
          {t("skipToContent")}
        </a>
        <NextIntlClientProvider messages={shellMessages}>
          <FoundationProvider config={foundationConfig}>
            <Header />
            <main className="flex-1" id="main-content">{children}</main>
            <Footer />
            <FlashToast />
            <HomeHint />
          </FoundationProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
