import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";

/**
 * Every route under `src/app/[locale]/` (locale prefix stripped; `[id]` = any single segment), for the proxy's
 * "does this in-locale path match a route?" check. `src/test/locale-routes.test.ts` derives the same list from the
 * file system (page.tsx files + the opengraph-image metadata route), so adding or removing a page fails the test until
 * this list is updated. `/page-not-found` is deliberately absent: a direct visit gets the 404 status too.
 */
export const localeRoutePatterns = [
  "/",
  "/account",
  "/admin",
  "/admin/bounties",
  "/admin/hall-of-fame",
  "/admin/notices",
  "/admin/users",
  "/agents",
  "/agents/register",
  "/applications",
  "/auth/callback",
  "/bounties",
  "/bounties/[id]",
  "/bounties/apply",
  "/hall-of-fame",
  "/members",
  "/members/[id]",
  "/notices",
  "/notices/[id]",
  "/opengraph-image/[id]",
  "/signup",
  "/signup/get-started",
  "/signup/profile",
  "/signup/wallet",
] as const;

/** The static in-locale 404 document the proxy rewrites misses to (`src/app/[locale]/page-not-found/page.tsx`). */
export const NOT_FOUND_SEGMENT = "page-not-found";

const compiled = localeRoutePatterns.map((pattern) => pattern.split("/").filter(Boolean));

/** True when `path` (locale prefix already stripped, e.g. `/bounties/x`) matches one of `localeRoutePatterns`. */
export function matchesLocaleRoute(path: string): boolean {
  const segments = path.split("/").filter(Boolean);
  return compiled.some(
    (pattern) =>
      pattern.length === segments.length &&
      pattern.every((part, index) => part === "[id]" || part === segments[index]),
  );
}

/** Proxy check: the locale of an in-locale path that matches no route (`/ko/nope` -> "ko"), otherwise null. */
export function inLocaleMiss(pathname: string): string | null {
  const [, locale, ...rest] = pathname.split("/");
  if (!hasLocale(routing.locales, locale)) return null;
  return matchesLocaleRoute(`/${rest.join("/")}`) ? null : locale;
}
