import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageMessages } from "@/components/layout/PageMessages";
import { localeAlternates } from "@/i18n/alternates";

// BE redirects to /auth/callback#loginCode=..; the locale proxy forwards it here and the browser keeps the fragment.
export async function generateMetadata({ params }: LayoutProps<"/[locale]/auth/callback">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "signup.authCallback" });
  return { alternates: localeAlternates(locale, "/auth/callback"), title: t("metaTitle"), robots: { index: false, follow: false } };
}

// The callback page is a client component reading signup.authCallback.
export default async function AuthCallbackLayout({ children, params }: LayoutProps<"/[locale]/auth/callback">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PageMessages namespaces={["signup"]}>{children}</PageMessages>;
}
