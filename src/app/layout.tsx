// The document (<html>/<body>) is `components/layout/AppShell`, rendered by app/[locale]/layout.tsx and by the root
// app/not-found.tsx (router-level 404s render outside the [locale] segment). This pass-through stays html-less on
// purpose: it must not duplicate the document. Never read `headers()`/`getLocale()` (or a locale-less next-intl API)
// here or in app/not-found.tsx: both are part of every page's render, so one request-time read makes EVERY route dynamic.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
