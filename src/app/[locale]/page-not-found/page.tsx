import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { NotFoundSection } from "@/components/layout/NotFoundSection";
import { routing } from "@/i18n/routing";

// Static (generateStaticParams comes from [locale]/layout.tsx) localized 404 document. `src/proxy.ts` rewrites every
// in-locale miss here with `status: 404` (unknown paths, detail ids that cannot exist, and this path itself), so the
// visitor gets a fully server-rendered page with the right `<html lang>` while every other route stays static.
// A `notFound()` thrown during render cannot do this: React SSR has no error boundaries, so Next answers with the bare
// `<html id="__next_error__">` shell (see AGENTS.md "Routing / 404").

export async function generateMetadata({ params }: PageProps<"/[locale]/page-not-found">): Promise<Metadata> {
  const { locale: requested } = await params;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "common.notFound" });
  // A prerendered page cannot know its rewritten status, so noindex is explicit; `alternates: {}` drops the inherited
  // locale-home canonical.
  return { title: t("metaTitle"), robots: { index: false, follow: false }, alternates: {} };
}

export default async function PageNotFound({ params }: PageProps<"/[locale]/page-not-found">) {
  const { locale: requested } = await params;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  setRequestLocale(locale);
  return <NotFoundSection locale={locale} />;
}
