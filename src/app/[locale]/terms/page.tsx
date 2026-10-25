import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { LegalDocument } from "@/components/legal/LegalDocument";
import { localeAlternates } from "@/i18n/alternates";

export async function generateMetadata({ params }: PageProps<"/[locale]/terms">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.terms.metadata" });
  return {
    alternates: localeAlternates(locale, "/terms"),
    title: t("title"),
    description: t("description"),
  };
}

export default async function TermsPage({ params }: PageProps<"/[locale]/terms">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalDocument document="terms" />;
}
