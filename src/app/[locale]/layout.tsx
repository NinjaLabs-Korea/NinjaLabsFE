import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Inter, Space_Grotesk } from "next/font/google";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { FoundationProvider } from "@/components/auth/FoundationProvider";
import { localeTags, routing } from "@/i18n/routing";
import { previewUser } from "@/lib/mocks/fixtures";
import { composeFoundationRuntime, loadRuntimeConfig } from "@/lib/runtime/config";
import "../globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "common.site" });
  const title = t("title");
  const description = t("description");

  return {
    metadataBase: new URL(loadRuntimeConfig().origin),
    title,
    description,
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(routing.locales.map((l) => [localeTags[l].htmlLang, `/${l}`])),
    },
    openGraph: {
      title,
      description,
      siteName: "Ninja Labs",
      type: "website",
      locale: localeTags[locale].ogLocale,
      url: `/${locale}`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

const { foundationConfig } = composeFoundationRuntime(previewUser);

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "common.layout" });

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
        <NextIntlClientProvider>
          <FoundationProvider config={foundationConfig}>
            <Header />
            <main className="flex-1" id="main-content">{children}</main>
            <Footer />
          </FoundationProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
