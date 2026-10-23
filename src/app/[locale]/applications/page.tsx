import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ApplicationsView } from "@/components/account/ApplicationsView";

type ApplicationsPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: ApplicationsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "account.applications.meta" });
  return { title: t("title"), description: t("description") };
}

export default async function ApplicationsPage({ params }: ApplicationsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("account.applications");
  const tAccount = await getTranslations("account.common");
  return (
    <section className="mx-auto max-w-content px-6 py-16 pb-20">
      {/* The masthead renders for every auth state; the view below switches between loading / signed-out / list. */}
      <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{tAccount("eyebrow")}</p>
      <h1 className="mt-2 font-display text-5xl -tracking-[0.48px] text-ink">{t("heading")}</h1>
      <p className="mt-4 text-lg text-ink-muted">{t("intro")}</p>
      <div className="mt-8">
        <ApplicationsView />
      </div>
    </section>
  );
}
