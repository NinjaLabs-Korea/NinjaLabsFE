import { getTranslations } from "next-intl/server";
import { type NotFoundCopy, NotFoundContent } from "@/components/layout/NotFoundContent";
import type { Locale } from "@/i18n/routing";

/** Server-side `common.notFound` strings for one locale (explicit locale: no request headers are read). */
export async function getNotFoundCopy(locale?: Locale): Promise<NotFoundCopy> {
  const t = locale ? await getTranslations({ locale, namespace: "common.notFound" }) : await getTranslations("common.notFound");
  return { title: t("title"), description: t("description"), home: t("home"), notices: t("notices") };
}

/**
 * Localized 404 content (`common.notFound`): rendered by the static `[locale]/page-not-found` route (explicit `locale`)
 * and by the `[locale]/not-found.tsx` boundary (request locale set by `[locale]/layout.tsx`).
 */
export async function NotFoundSection({ locale }: { locale?: Locale }) {
  return <NotFoundContent copy={await getNotFoundCopy(locale)} locale={locale} />;
}
