import { hasLocale } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/AppShell";
import { NotFoundSection } from "@/components/layout/NotFoundSection";
import { routing } from "@/i18n/routing";

// Router-level 404 (`/_not-found`): URLs that match no route, including the proxy's rewrites for unknown detail ids.
// It renders outside app/[locale]/layout.tsx, so it supplies the whole document through AppShell. The locale comes
// from the `x-next-intl-locale` request header the proxy sets (`src/i18n/request.ts` falls back to the default).
export default async function RootNotFound() {
  const requested = await getLocale();
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "common.notFound" });

  return (
    <AppShell locale={locale}>
      {/* not-found.tsx cannot export metadata; React hoists this <title> into <head>. */}
      <title>{t("metaTitle")}</title>
      <NotFoundSection />
    </AppShell>
  );
}
