import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";

// BE redirects to /auth/callback#loginCode=..; the locale proxy forwards it here and the browser keeps the fragment.
export async function generateMetadata({ params }: LayoutProps<"/[locale]/auth/callback">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "signup.authCallback" });
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

export default function AuthCallbackLayout({ children }: { children: ReactNode }) {
  return children;
}
