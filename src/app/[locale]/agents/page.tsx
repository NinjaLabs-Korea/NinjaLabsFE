import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AgentsView } from "@/components/account/AgentsView";
import { Link } from "@/i18n/navigation";
import { localeAlternates } from "@/i18n/alternates";

type AgentsPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: AgentsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "agents.meta.list" });
  // Owner-private (robots.ts disallows /<locale>/agents); noindex as a second line, like the account page.
  return { alternates: localeAlternates(locale, "/agents"), title: t("title"), description: t("description"), robots: { index: false, follow: false } };
}

export default async function AgentsPage({ params }: AgentsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("agents.list");
  const tAccount = await getTranslations("account.common");
  return (
    <section className="mx-auto max-w-content px-6 py-16 pb-20">
      {/* The masthead renders for every auth state; the view below switches between loading / signed-out / list. */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{tAccount("eyebrow")}</p>
          <h1 className="mt-2 font-display text-4xl -tracking-[0.36px] sm:text-5xl sm:-tracking-[0.48px] text-ink">{t("heading")}</h1>
          <p className="mt-4 text-lg text-ink-muted">{t("intro")}</p>
        </div>
        <Link
          className="rounded-control border border-primary-outline px-[21px] py-3 text-sm leading-[21px] font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          href="/agents/register"
        >
          {t("registerNew")}
        </Link>
      </div>
      <div className="mt-8">
        <AgentsView />
      </div>
    </section>
  );
}
