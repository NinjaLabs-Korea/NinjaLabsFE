import { NotFoundSection } from "@/components/layout/NotFoundSection";

// Boundary for `notFound()` thrown inside the [locale] segment - in practice only a well-formed but missing detail id
// in api mode (bounty/notice UUID, member nickname), which the proxy cannot judge without a BE call. The server cannot
// stream this boundary (React SSR has no error boundaries: the response is Next's bare `<html id="__next_error__">`
// shell with status 404); it renders after hydration. Every other in-locale miss is rewritten by `src/proxy.ts` to the
// static, fully server-rendered `[locale]/page-not-found` page.
export default function NotFound() {
  return <NotFoundSection />;
}
