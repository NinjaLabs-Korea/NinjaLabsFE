import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { WalletConnectButton } from "@/components/wallet/WalletConnectButton";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { Badge } from "@/components/ui/Badge";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { Link } from "@/i18n/navigation";
import { previewUser } from "@/lib/mocks/fixtures";
import { composeFoundationRuntime } from "@/lib/runtime/config";

const { foundationConfig, wallet: walletConnectionConfig } = composeFoundationRuntime(previewUser);
const isApiMode = foundationConfig.mode === "api";
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

// Keys under messages `signup.wallet.steps`.
const walletSteps = ["connection", "signing", "gas", "accountLinking", "nft"];

export async function generateMetadata({ params }: PageProps<"/[locale]/signup/wallet">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "signup.wallet.metadata" });
  return {
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
        <div className="flex justify-end">
          <Badge variant="danger">
            {walletConnectionConfig
              ? isApiMode ? t("badges.flow") : t("badges.walletPreview")
              : t("badges.walletUnavailable")}
          </Badge>
        </div>
        <div className="mt-8">
          <StepIndicator current={2} />
        </div>
        <div className="mt-6 grid gap-5 lg:grid-cols-5">
          <article className="rounded-card border border-border bg-surface p-5 shadow-card sm:p-[21px] lg:col-span-3">
            <h1 className="font-display text-4xl -tracking-[0.36px] text-ink">
              {t("wallet.title")}
            </h1>
            <p className="mt-3 text-base text-ink-muted">
              {isApiMode ? t("wallet.introApi") : t("wallet.introMock")}
            </p>
            <div className="mt-5 [&_button]:w-full">
              {walletConnectionConfig ? (
                <WalletProvider
                  chainId={walletConnectionConfig.chainId}
                  rpcUrl={walletConnectionConfig.rpcUrl}
                  walletConnectProjectId={walletConnectProjectId}
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
              className="mt-5 block w-full rounded-control border border-primary-outline px-5 py-3 text-center text-sm font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              href="/signup/profile"
            >
              {t("wallet.connectLater")}
            </Link>
            <p className="mt-4 text-sm text-ink-muted">
              {t("wallet.optionalNote")}
            </p>
          </article>
          <aside className="rounded-card border border-border bg-surface p-5 shadow-card sm:p-[21px] lg:col-span-2">
            <h2 className="font-display text-2xl -tracking-[0.24px] text-ink">
              {t("wallet.whatHappens")}
            </h2>
            <dl className="mt-5 space-y-4">
              {walletSteps.map((step) => (
                <div key={step}>
                  <dt className="text-sm font-semibold text-ink">{t(`wallet.steps.${step}.term`)}</dt>
                  <dd className="mt-1 text-sm text-ink-muted">{t(`wallet.steps.${step}.detail`)}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </div>
    </section>
  );
}
