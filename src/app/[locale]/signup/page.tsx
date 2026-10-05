import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";
import { Badge } from "@/components/ui/Badge";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { signup } from "@/lib/signup";
import { loadRuntimeConfig } from "@/lib/runtime/config";

export async function generateMetadata({ params }: PageProps<"/[locale]/signup">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "signup.login" });
  const mode = loadRuntimeConfig().runtimeMode;

  return {
    title: t("pageTitle", { title: t(`${mode}.title`) }),
    description: t(`${mode}.description`),
  };
}

export default async function SignupPage({ params }: PageProps<"/[locale]/signup">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations(`signup.login.${loadRuntimeConfig().runtimeMode}`);
  return (
    <section className="mx-auto max-w-content px-6 py-16 pb-20">
      <div className="mx-auto max-w-[768px]">
        <div className="flex justify-end">
          <Badge variant="danger">{t("badge")}</Badge>
        </div>
        <div className="mt-8">
          <StepIndicator current={1} />
        </div>
        <div className="mx-auto mt-6 max-w-[576px] rounded-card border border-border bg-surface p-5 shadow-card sm:p-[21px]">
          <h1 className="font-display text-4xl -tracking-[0.36px] text-ink">{t("title")}</h1>
          <p className="mt-3 text-base text-ink-muted">{t("description")}</p>
          <GoogleLoginButton />
          <div className="mt-5 rounded-tile border border-border bg-primary-soft p-4 text-sm text-ink-notice">
            {t("disclosure")}
          </div>
        </div>
        <div className="mx-auto mt-5 max-w-[576px] rounded-card border border-border bg-surface p-5 shadow-card sm:p-[21px]">
          <h2 className="font-display text-lg font-bold text-ink">{t("statusTitle")}</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink-muted">
            {signup.login.edgeCaseKeys.map((edgeCase) => (
              <li key={edgeCase}>{t(`edgeCases.${edgeCase}`)}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
