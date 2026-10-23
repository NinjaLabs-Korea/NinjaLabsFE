import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AppShell } from "@/components/layout/AppShell";
import { localeTags, routing } from "@/i18n/routing";
import { loadRuntimeConfig } from "@/lib/runtime/config";

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

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return <AppShell locale={locale}>{children}</AppShell>;
}
