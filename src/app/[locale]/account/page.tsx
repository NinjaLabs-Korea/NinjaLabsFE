import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AccountSettingsView } from "@/components/account/AccountSettingsView";
import { localeAlternates } from "@/i18n/alternates";

type AccountPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: AccountPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "account.settings.meta" });
  // Owner-private (robots.ts disallows /<locale>/account); noindex as a second line.
  return {
    alternates: localeAlternates(locale, "/account"),
    title: t("title"),
    description: t("description"),
    robots: { index: false, follow: false },
  };
}

export default async function AccountPage({ params }: AccountPageProps) {
  // Nonce route (lib/csp.ts NONCE_ROUTE_PATTERNS): the CSP nonce is per request, so this must not be prerendered.
  await connection();
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("account.settings");
  const tAccount = await getTranslations("account.common");
  return (
    <section className="mx-auto max-w-content px-6 py-16 pb-20">
      {/* The masthead renders for every auth state; the view below switches between loading / signed-out / settings. */}
      <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{tAccount("eyebrow")}</p>
      <h1 className="mt-2 font-display text-4xl -tracking-[0.36px] sm:text-5xl sm:-tracking-[0.48px] text-ink">{t("heading")}</h1>
      <p className="mt-4 text-lg text-ink-muted">{t("intro")}</p>
      <div className="mt-8">
        <AccountSettingsView />
      </div>
    </section>
  );
}
