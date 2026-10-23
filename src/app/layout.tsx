// The document (<html>/<body>) is `components/layout/AppShell`, rendered by app/[locale]/layout.tsx and by the root
// app/not-found.tsx (router-level 404s render outside the [locale] segment). This pass-through stays html-less on
// purpose: it must not duplicate the document, and reading the locale here would make every route dynamic.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
