import { NotFoundSection } from "@/components/layout/NotFoundSection";

// Boundary for `notFound()` thrown inside the [locale] segment (e.g. a well-formed but missing detail id in api mode).
// The server cannot stream this boundary (React SSR has no error boundaries: the response is Next's bare
// `<html id="__next_error__">` shell with status 404); it renders after hydration. Router-level 404s (unknown paths,
// ids the proxy rejects) are served fully rendered by app/not-found.tsx instead.
export default function NotFound() {
  return <NotFoundSection />;
}
