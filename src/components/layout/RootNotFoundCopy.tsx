"use client";

import { useEffect, useState } from "react";
import { type NotFoundCopy, NotFoundContent } from "@/components/layout/NotFoundContent";
import { type Locale, localeTags, routing } from "@/i18n/routing";

type RootNotFoundCopyProps = {
  copies: Record<Locale, NotFoundCopy & { metaTitle: string }>;
};

/**
 * Client half of the static root `app/not-found.tsx`: the server HTML is English (`<html lang="en">`), and after
 * hydration this swaps the copy, `document.documentElement.lang` and `document.title` to the locale in the URL's first
 * segment (e.g. `/ko/logo.svg`, a proxy-excluded path). The locale is read in an effect, not during render, so the
 * first client render matches the English server HTML (no hydration mismatch).
 */
export function RootNotFoundCopy({ copies }: RootNotFoundCopyProps) {
  const [locale, setLocale] = useState<Locale>(routing.defaultLocale);

  useEffect(() => {
    const first = window.location.pathname.split("/")[1] ?? "";
    const detected = (routing.locales as readonly string[]).includes(first) ? (first as Locale) : routing.defaultLocale;
    // Syncing from an external system (the URL) once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocale(detected);
    document.documentElement.lang = localeTags[detected].htmlLang;
    document.title = copies[detected].metaTitle;
  }, [copies]);

  return <NotFoundContent copy={copies[locale]} locale={locale} />;
}
