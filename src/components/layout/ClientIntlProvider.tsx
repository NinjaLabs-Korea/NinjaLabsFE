"use client";

import { NextIntlClientProvider } from "next-intl";
import type { ComponentProps } from "react";

/**
 * The plain (client) `NextIntlClientProvider`. Imported from a server component, `next-intl` resolves to its server
 * provider, which fills every omitted prop (`now`, `formats`, `locale`, ...) from the request config - a locale-less
 * read that calls `headers()` unless `setRequestLocale` ran. The static root `app/not-found.tsx` cannot call
 * `setRequestLocale` (it is part of every page's render), so it provides `locale`/`messages`/`timeZone` through this
 * client entry and nothing request-bound is read.
 */
export function ClientIntlProvider(props: ComponentProps<typeof NextIntlClientProvider>) {
  return <NextIntlClientProvider {...props} />;
}
