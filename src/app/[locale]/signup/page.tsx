import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { signup } from "@/lib/signup";
import { loadRuntimeConfig } from "@/lib/runtime/config";
import { localeAlternates } from "@/i18n/alternates";

export async function generateMetadata({ params }: PageProps<"/[locale]/signup">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "signup.login" });
  const mode = loadRuntimeConfig().runtimeMode;

  return {
    alternates: localeAlternates(locale, "/signup"),
    title: t("pageTitle", { title: t(`${mode}.title`) }),
    description: t(`${mode}.description`),
  };
}

export default async function SignupPage({ params }: PageProps<"/[locale]/signup">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tLogin = await getTranslations("signup.login");
  const t = await getTranslations(`signup.login.${loadRuntimeConfig().runtimeMode}`);
  return (
    <section className="mx-auto max-w-content px-6 py-16 pb-20">
      <div className="mx-auto max-w-[768px]">
        <div>
          <StepIndicator current={1} />
        </div>
        <div className="mx-auto mt-6 max-w-[576px] rounded-card border border-border bg-surface p-5 shadow-card sm:p-[21px]">
          <div className="text-center">
            <Image alt="" className="mx-auto size-11 rounded-logo" height={44} src="/figma/ninja-labs-mascot.png" width={44} />
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.96px] text-primary">{tLogin("eyebrow")}</p>
            <h1 className="mt-3 font-display text-4xl -tracking-[0.36px] text-ink">{t("title")}</h1>
            <p className="mt-3 text-base text-ink-muted">{t("description")}</p>
          </div>
          <GoogleLoginButton turnstileSiteKey={loadRuntimeConfig().turnstileSiteKey} />
          <div className="mt-5 rounded-tile border border-border bg-primary-soft p-4 text-center text-sm text-ink-notice">
            {t("disclosure")}
          </div>
          <div className="mt-5 rounded-tile border border-border bg-surface p-[21px]">
            <h2 className="font-display text-lg font-bold text-ink">{t("statusTitle")}</h2>
            <ul className="mt-3 space-y-2 text-sm text-ink-muted">
              {signup.login.edgeCaseKeys.map((edgeCase) => (
                <li key={edgeCase}>{t(`edgeCases.${edgeCase}`)}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
