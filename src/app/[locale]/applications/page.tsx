import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ApplicationsView } from "@/components/account/ApplicationsView";
import { localeAlternates } from "@/i18n/alternates";

type ApplicationsPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: ApplicationsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "account.applications.meta" });
  // Owner-private (robots.ts disallows /<locale>/applications); noindex as a second line, like the account page.
  return { alternates: localeAlternates(locale, "/applications"), title: t("title"), description: t("description"), robots: { index: false, follow: false } };
}

export default async function ApplicationsPage({ params }: ApplicationsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("account.applications");
  const tAccount = await getTranslations("account.common");
  return (
    <section className="mx-auto min-h-[60dvh] max-w-content px-gutter py-16 pb-20">
      {/* The masthead renders for every auth state; the view below switches between loading / signed-out / list. */}
      <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{tAccount("eyebrow")}</p>
      <h1 className="mt-2 font-display text-4xl -tracking-[0.36px] sm:text-5xl sm:-tracking-[0.48px] text-ink">{t("heading")}</h1>
      <p className="mt-4 text-lg text-ink-muted">{t("intro")}</p>
      <div className="mt-8">
        <ApplicationsView />
      </div>
    </section>
  );
}
