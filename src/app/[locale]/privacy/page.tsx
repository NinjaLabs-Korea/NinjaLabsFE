import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { LegalDocument } from "@/components/legal/LegalDocument";
import { localeAlternates } from "@/i18n/alternates";

export async function generateMetadata({ params }: PageProps<"/[locale]/privacy">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.privacy.metadata" });
  return {
    alternates: localeAlternates(locale, "/privacy"),
    title: t("title"),
    description: t("description"),
  };
}

export default async function PrivacyPage({ params }: PageProps<"/[locale]/privacy">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalDocument document="privacy" />;
}
