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
  return (
    <section className="mx-auto max-w-content px-6 py-16 pb-20">
      <ApplicationsView />
    </section>
  );
}
