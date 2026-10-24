import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { detailMayExist, resolveDetailRoute } from "./lib/detail-id";
import { inLocaleMiss, NOT_FOUND_SEGMENT } from "./lib/locale-routes";

// Redirects unprefixed paths to /<locale>/... using the NEXT_LOCALE cookie,
// then Accept-Language, then the default locale.
const handleLocale = createMiddleware(routing);

/**
 * `/<locale>/...` paths that match no route (`lib/locale-routes.ts`) or name a detail id that cannot exist
 * (`lib/detail-id.ts detailMayExist`, shape-based, no BE round trip) are rewritten with status 404 to the STATIC
 * `/<locale>/page-not-found` page, so the 404 is fully server-rendered and localized while every route stays
 * prerendered. A `notFound()` thrown while rendering cannot do that: React SSR has no error boundaries, so Next answers
 * with the bare `<html id="__next_error__">` shell and the boundary only appears after hydration. The `[id]` pages
 * keep their own existence check for well-formed ids the proxy cannot judge.
 *
 * The rewritten response carries `x-middleware-rewrite: /<locale>/page-not-found`. Next's router adds that header after
 * this function returns (`next/dist/server/lib/router-utils/resolve-routes.js`), so it cannot be removed here, and
 * `next.config.ts headers()` can only set headers. It reveals nothing but that internal path; left as is.
 */
export default async function proxy(request: NextRequest) {
  const response = handleLocale(request);
  const { pathname } = request.nextUrl;
  const detail = resolveDetailRoute(pathname);
  const locale = inLocaleMiss(pathname) ?? (detail && !(await detailMayExist(detail.kind, detail.id)) ? detail.locale : null);
  if (!locale) return response;

  const notFound = NextResponse.rewrite(new URL(`/${locale}/${NOT_FOUND_SEGMENT}`, request.url), { status: 404 });
  for (const cookie of response.headers.getSetCookie()) notFound.headers.append("set-cookie", cookie);
  return notFound;
}

export const config = {
  // Skip Next internals, persisted media, the same-origin auth proxy (/api/auth/* rewrite to the BE - a locale redirect
  // would break the cookie-mode refresh), the unprefixed /skill.md download, and real static files (by extension).
  // Dotted segments such as /members/ninja.inj (BE nicknames allow dots, Injective handles end in .inj) must still
  // locale-redirect, so only a known static-file extension is excluded. Keep this a literal: Next parses it at build time.
  matcher: [
    "/((?!_next|_vercel|media|api/|skill\\.md$|.*\\.(?:ico|png|jpg|jpeg|gif|svg|webp|avif|txt|xml|json|js|css|map|woff|woff2|ttf)$).*)",
  ],
};
