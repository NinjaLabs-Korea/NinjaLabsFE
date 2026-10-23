import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { detailMayExist, resolveDetailRoute } from "./lib/detail-id";

// Redirects unprefixed paths to /<locale>/... using the NEXT_LOCALE cookie,
// then Accept-Language, then the default locale.
const handleLocale = createMiddleware(routing);

/**
 * Detail URLs whose id cannot exist (`lib/detail-id.ts detailMayExist`) are rewritten to a path no route matches, so
 * Next serves the router-level 404 (`app/not-found.tsx`, fully rendered, status 404). A `notFound()` thrown while
 * rendering cannot do that: React SSR has no error boundaries, so Next answers with the bare `<html id="__next_error__">`
 * shell and the localized boundary only appears after hydration. The `[id]` pages keep their own existence check.
 * The decision is shape-based only (no BE round trip per request): see `detailMayExist`.
 */
export default async function proxy(request: NextRequest) {
  const response = handleLocale(request);
  const detail = resolveDetailRoute(request.nextUrl.pathname);
  if (!detail || (await detailMayExist(detail.kind, detail.id))) return response;

  const headers = new Headers(request.headers);
  // What next-intl's middleware sets on the request it forwards: `src/i18n/request.ts` reads the locale from it.
  headers.set("x-next-intl-locale", detail.locale);
  const notFound = NextResponse.rewrite(new URL(`${request.nextUrl.pathname}/__not-found__`, request.url), {
    request: { headers },
  });
  for (const cookie of response.headers.getSetCookie()) notFound.headers.append("set-cookie", cookie);
  return notFound;
}

export const config = {
  // Skip Next internals, persisted media, the unprefixed /skill.md download, and real static files (by extension).
  // Dotted segments such as /members/ninja.inj (BE nicknames allow dots, Injective handles end in .inj) must still
  // locale-redirect, so only a known static-file extension is excluded. Keep this a literal: Next parses it at build time.
  matcher: [
    "/((?!_next|_vercel|media|skill\\.md$|.*\\.(?:ico|png|jpg|jpeg|gif|svg|webp|avif|txt|xml|json|js|css|map|woff|woff2|ttf)$).*)",
  ],
};
