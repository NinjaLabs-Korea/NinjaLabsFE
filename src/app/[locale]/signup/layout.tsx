import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";
import { PageMessages } from "@/components/layout/PageMessages";

// Client islands: SignupGate, ProfileForm, CompleteOnboarding read signup.*.
export default async function SignupLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PageMessages namespaces={["signup"]}>{children}</PageMessages>;
}
