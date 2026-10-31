import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SignupGate } from "@/components/signup/SignupGate";
import { ProfileForm } from "@/components/signup/ProfileForm";
import { SignupStepIndicator } from "@/components/signup/SignupStepIndicator";
import { localeAlternates } from "@/i18n/alternates";

export async function generateMetadata({ params }: PageProps<"/[locale]/signup/profile">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "signup.profile.metadata" });
  return {
    alternates: localeAlternates(locale, "/signup/profile"),
    // Signed-in onboarding step: nothing to index.
    robots: { index: false, follow: false },
    title: t("title"),
    description: t("description"),
  };
}

export default async function SignupProfilePage({ params }: PageProps<"/[locale]/signup/profile">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("signup");
  return (
    <section className="mx-auto max-w-content px-gutter py-16 pb-20">
      <div className="mx-auto max-w-[1024px]">
        <div>
          <SignupStepIndicator current={3} />
        </div>
        <div className="mt-6">
          <SignupGate step={3}>
            <section className="mx-auto max-w-[640px] rounded-card border border-border bg-surface p-5 shadow-card sm:p-[21px]">
              <div className="text-center">
                <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{t("profile.eyebrow")}</p>
                <h1 className="mt-3 font-display text-4xl -tracking-[0.36px] text-ink">{t("profile.title")}</h1>
                <p className="mt-3 text-base text-ink-muted">{t("profile.subtitle")}</p>
              </div>
              <ProfileForm />
            </section>
          </SignupGate>
        </div>
      </div>
    </section>
  );
}
