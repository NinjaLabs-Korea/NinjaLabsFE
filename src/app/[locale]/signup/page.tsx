import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";
import { SignupGate } from "@/components/signup/SignupGate";
import { SignupStepIndicator } from "@/components/signup/SignupStepIndicator";
import { loadRuntimeConfig } from "@/lib/runtime/config";
import { localeMetadata } from "@/i18n/alternates";

export async function generateMetadata({ params }: PageProps<"/[locale]/signup">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "signup.login" });
  const mode = loadRuntimeConfig().runtimeMode;

  return localeMetadata(locale, "/signup", { title: t("pageTitle", { title: t(`${mode}.title`) }), description: t(`${mode}.description`) });
}

export default async function SignupPage({ params }: PageProps<"/[locale]/signup">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tLogin = await getTranslations("signup.login");
  const config = loadRuntimeConfig();
  const t = await getTranslations(`signup.login.${config.runtimeMode}`);
  // Mock mode never renders the widget (GoogleLoginButton), so only api mode with a site key reserves its height.
  const withTurnstile = config.runtimeMode !== "mock" && Boolean(config.turnstileSiteKey);
  return (
    <section className="mx-auto max-w-content px-6 py-16 pb-20">
      <div className="mx-auto max-w-[768px]">
        <div>
          <SignupStepIndicator current={1} />
        </div>
        <div className="mx-auto mt-6 max-w-[576px] rounded-card border border-border bg-surface p-5 shadow-card sm:p-[21px]">
          <div className="text-center">
            <Image alt="" className="mx-auto size-11 rounded-logo" height={44} src="/figma/ninja-labs-mascot.png" width={44} />
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.96px] text-primary">{tLogin("eyebrow")}</p>
            <h1 className="mt-3 font-display text-4xl -tracking-[0.36px] text-ink">{t("title")}</h1>
            <p className="mt-3 text-base text-ink-muted">{t("description")}</p>
          </div>
          <SignupGate step={1} withTurnstile={withTurnstile}>
            <GoogleLoginButton turnstileSiteKey={config.turnstileSiteKey} />
            <div className="mt-5 rounded-tile border border-border bg-primary-soft p-4 text-center text-sm text-ink-notice">
              {t("disclosure")}
            </div>
          </SignupGate>
        </div>
      </div>
    </section>
  );
}
