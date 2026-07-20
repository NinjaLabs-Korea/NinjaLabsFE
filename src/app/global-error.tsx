"use client"; // Required by Next.js error boundary contract.

// The global boundary replaces the root layout entirely, so it must load
// global styles and font variables itself (Next 16 error convention).
import { Inter, Space_Grotesk } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" });

type GlobalErrorPageProps = {
  reset: () => void;
};

export default function GlobalErrorPage({ reset }: GlobalErrorPageProps) {
  return (
    <html className={`${inter.variable} ${spaceGrotesk.variable}`} lang="en">
      <body className="bg-page text-ink font-sans antialiased min-h-dvh flex flex-col">
        <section className="mx-auto max-w-content px-6 py-24 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">ERROR</p>
          <h1 className="mt-3 font-display text-5xl -tracking-[0.48px] text-ink">Something went wrong</h1>
          <p className="mt-4 text-lg text-ink-muted">We could not load this page. Please try again.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button className="rounded-control bg-primary px-5 py-3 text-sm font-semibold text-on-inverse hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={reset} type="button">Try again</button>
            <Link className="rounded-control border border-primary-outline px-5 py-3 text-sm font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href="/">Back to home</Link>
          </div>
        </section>
      </body>
    </html>
  );
}
