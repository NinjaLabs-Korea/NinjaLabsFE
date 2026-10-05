import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AgentsView } from "@/components/account/AgentsView";

type AgentsPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: AgentsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "agents.meta.list" });
  return { title: t("title"), description: t("description") };
}

export default async function AgentsPage({ params }: AgentsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <section className="mx-auto max-w-content px-6 py-16 pb-20">
      <AgentsView />
    </section>
  );
}
