// Catches paths the locale proxy does not rewrite (e.g. unknown files).
// It renders outside app/[locale]/layout.tsx, so it supplies its own document.
import Link from "next/link";
import "./globals.css";

export default function RootNotFound() {
  return (
    <html lang="en">
      <body className="bg-page text-ink font-sans antialiased min-h-dvh">
        <section className="mx-auto max-w-content px-6 py-24 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">404</p>
          <h1 className="mt-3 text-5xl -tracking-[0.48px] text-ink">Page not found</h1>
          <Link className="mt-8 inline-block rounded-control bg-primary px-5 py-3 text-sm font-semibold text-on-inverse" href="/">Back to home</Link>
        </section>
      </body>
    </html>
  );
}
