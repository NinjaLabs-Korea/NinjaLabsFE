import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Redirects unprefixed paths to /<locale>/... using the NEXT_LOCALE cookie,
// then Accept-Language, then the default locale.
export default createMiddleware(routing);

export const config = {
  // Skip API-like paths, Next internals, persisted media, and files with an extension.
  matcher: ["/((?!_next|_vercel|media|.*\\..*).*)"],
};
