import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AgentRegisterForm } from "@/components/agents/AgentRegisterForm";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { Badge } from "@/components/ui/Badge";
import { Link } from "@/i18n/navigation";
import { previewUser } from "@/lib/mocks/fixtures";
import { composeFoundationRuntime } from "@/lib/runtime/config";

const { wallet: walletConnectionConfig } = composeFoundationRuntime(previewUser);
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

// Keys under agents.register.steps / agents.register.verificationItems.
const steps = ["doc", "publicKey", "ownership", "apiKey"] as const;

const verificationItems = ["challenge", "signature", "binding", "failure"] as const;

type AgentRegisterPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: AgentRegisterPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "agents.meta.register" });
  return { title: t("title"), description: t("description") };
}

export default async function AgentRegisterPage({ params }: AgentRegisterPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("agents.register");
  return (
    <div className="mx-auto max-w-content px-6 py-16 pb-20">
      <Link
        className="inline-block text-sm font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        href="/agents"
      >
        {t("back")}
      </Link>

      <section className="mt-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
        <div className="min-w-0 max-w-[48rem]">
          <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{t("eyebrow")}</p>
          <h1 className="mt-3 font-display text-5xl -tracking-[0.48px] text-ink">{t("heading")}</h1>
          <p className="mt-4 text-lg text-ink-secondary">{t("intro")}</p>
        </div>
        <Badge variant="primary-soft">{t("evmBadge")}</Badge>
      </section>

      <section className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((step, index) => (
          <article className="rounded-card border border-border bg-surface p-5 shadow-card" key={step}>
            <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-strong">{index + 1}</span>
            <h2 className="mt-4 font-display text-lg font-bold text-ink">{t(`steps.${step}.heading`)}</h2>
            <p className="mt-2 text-sm text-ink-secondary">{t(`steps.${step}.body`)}</p>
          </article>
        ))}
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-5">
        <article className="rounded-card border border-border bg-surface p-5 shadow-card lg:col-span-3">
          <h2 className="font-display text-2xl -tracking-[0.24px] text-ink">{t("verificationHeading")}</h2>
          <ul className="mt-5 space-y-4">
            {verificationItems.map((item) => (
              <li className="flex gap-3 text-base text-ink-secondary" key={item}>
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-success-soft text-xs font-bold text-success">✓</span>
                <span>{t(`verificationItems.${item}`)}</span>
              </li>
            ))}
          </ul>
        </article>

        {walletConnectionConfig ? (
          <WalletProvider
            chainId={walletConnectionConfig.chainId}
            rpcUrl={walletConnectionConfig.rpcUrl}
            walletConnectProjectId={walletConnectProjectId}
          >
            <AgentRegisterForm chainId={walletConnectionConfig.chainId} />
          </WalletProvider>
        ) : (
          <article className="rounded-card border border-border bg-surface p-5 shadow-card lg:col-span-2">
            <h2 className="font-display text-2xl text-ink">{t("walletUnavailableTitle")}</h2>
            <p className="mt-2 text-sm text-ink-muted">
              {t("walletUnavailableBody")}
            </p>
          </article>
        )}
      </section>

      <section className="mt-8 grid gap-5 md:grid-cols-2">
        <article className="rounded-tile border border-border bg-surface p-5">
          <p className="text-sm text-ink-secondary">
            {t("multipleAgents")}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge variant="danger">{t("edgeCaseBadge")}</Badge>
            <p className="text-sm text-ink-secondary">{t("edgeCase")}</p>
          </div>
        </article>
        <article className="rounded-tile border border-border bg-surface p-5">
          <p className="text-sm text-ink-secondary">{t("ownership")}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge variant="warning">{t("unresolvedBadge")}</Badge>
            <p className="text-sm text-ink-secondary">{t("unresolved")}</p>
          </div>
        </article>
      </section>

      <p className="mt-4 text-xs text-ink-muted">
        {t.rich("profileNote", {
          link: (chunks) => <Link className="font-semibold text-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href="/members/jaemin#agents">{chunks}</Link>,
        })}
      </p>
    </div>
  );
}
