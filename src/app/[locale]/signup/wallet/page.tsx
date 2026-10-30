import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { LinkedWalletGate } from "@/components/signup/LinkedWalletGate";
import { SignupGate } from "@/components/signup/SignupGate";
import { WalletConnectButton } from "@/components/wallet/WalletConnectButton";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { Badge } from "@/components/ui/Badge";
import { SignupStepIndicator } from "@/components/signup/SignupStepIndicator";
import { Link } from "@/i18n/navigation";
import { previewUser } from "@/lib/mocks/fixtures";
import { composeFoundationRuntime } from "@/lib/runtime/config";
import { localeAlternates } from "@/i18n/alternates";

const { foundationConfig, wallet: walletConnectionConfig } = composeFoundationRuntime(previewUser);
const isApiMode = foundationConfig.mode === "api";

// Keys under messages `signup.wallet.steps`.
const walletSteps = ["connection", "signing", "gas", "accountLinking", "nft"];

export async function generateMetadata({ params }: PageProps<"/[locale]/signup/wallet">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "signup.wallet.metadata" });
  return {
    alternates: localeAlternates(locale, "/signup/wallet"),
    // Signed-in onboarding step: nothing to index.
    robots: { index: false, follow: false },
    title: t("title"),
    description: isApiMode ? t("descriptionApi") : t("descriptionMock"),
  };
}

export default async function SignupWalletPage({ params }: PageProps<"/[locale]/signup/wallet">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("signup");
  return (
    <section className="mx-auto max-w-content px-6 py-16 pb-20">
      <div className="mx-auto max-w-[1024px]">
        <div>
          <SignupStepIndicator current={2} />
        </div>
        <div className="mt-6">
          <SignupGate step={2}>
            <div className="mx-auto max-w-[640px]">
              <article className="rounded-card border border-border bg-surface p-5 shadow-card sm:p-[21px]">
                <div className="text-center">
                  <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{t("wallet.eyebrow")}</p>
                  <h1 className="mt-3 font-display text-4xl -tracking-[0.36px] text-ink">
                    {t("wallet.title")}
                  </h1>
                  <p className="mt-3 text-base text-ink-muted">
                    {isApiMode ? t("wallet.introApi") : t("wallet.introMock")}
                  </p>
                </div>
                <LinkedWalletGate>
                  <div className="mt-5 [&_button]:w-full">
                    {walletConnectionConfig ? (
                      <WalletProvider
                        chainId={walletConnectionConfig.chainId}
                        rpcUrl={walletConnectionConfig.rpcUrl}
                      >
                        <WalletConnectButton chainId={walletConnectionConfig.chainId} />
                      </WalletProvider>
                    ) : (
                      <div className="flex flex-col items-start gap-2">
                        <button
                          className="w-full rounded-control border border-border bg-surface px-5 py-3 text-base font-semibold text-ink-secondary disabled:cursor-not-allowed disabled:opacity-60"
                          disabled
                          type="button"
                        >
                          {t("wallet.unavailableButton")}
                        </button>
                        <p className="text-xs text-ink-muted" role="status">
                          {t("wallet.unavailableNote")}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="mt-5 rounded-tile border border-border bg-primary-soft p-4">
                    <Badge variant="primary-soft">
                      {isApiMode ? t("wallet.badgeApi") : t("wallet.badgeMock")}
                    </Badge>
                    <p className="mt-2 text-sm text-ink-notice">
                      {isApiMode ? t("wallet.noteApi") : t("wallet.noteMock")}
                    </p>
                  </div>
                  <Link
                    className="mt-5 flex min-h-11 w-full items-center justify-center rounded-control border border-border px-4 py-3 text-center text-sm font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    href="/signup/profile"
                  >
                    {t("wallet.connectLater")}
                  </Link>
                  <p className="mt-4 text-center text-sm text-ink-muted">
                    {t("wallet.optionalNote")}
                  </p>
                  <details className="mt-4 text-sm text-ink-muted">
                    <summary className="cursor-pointer font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                      {t("wallet.moreDetails")}
                    </summary>
                    <dl className="mt-3 space-y-3">
                      {walletSteps.map((step) => (
                        <div key={step}>
                          <dt className="font-semibold text-ink">{t(`wallet.steps.${step}.term`)}</dt>
                          <dd className="mt-0.5">{t(`wallet.steps.${step}.detail`)}</dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                </LinkedWalletGate>
              </article>
            </div>
          </SignupGate>
        </div>
      </div>
    </section>
  );
}
