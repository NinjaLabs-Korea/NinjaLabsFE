"use client"; // Required by Next.js error boundary contract.

import { useTranslations } from "next-intl";
import { startTransition } from "react";
import { Link, useRouter } from "@/i18n/navigation";

type ErrorPageProps = {
  reset: () => void;
};

export default function ErrorPage({ reset }: ErrorPageProps) {
  const t = useTranslations("common.errorPage");
  const router = useRouter();
  // reset() alone only re-renders the client tree; a server-component error needs the RSC payload re-fetched first.
  const retry = () => startTransition(() => {
    router.refresh();
    reset();
  });

  return (
    <section className="mx-auto max-w-content px-gutter py-24 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">{t("eyebrow")}</p>
      <h1 className="mt-3 font-display text-4xl -tracking-[0.36px] sm:text-5xl sm:-tracking-[0.48px] text-ink">{t("title")}</h1>
      <p className="mt-4 text-lg text-ink-muted">{t("description")}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button className="rounded-control bg-primary px-5 py-3 text-sm font-semibold text-on-inverse hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={retry} type="button">{t("retry")}</button>
        <Link className="rounded-control border border-primary-outline px-5 py-3 text-sm font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href="/">{t("home")}</Link>
      </div>
    </section>
  );
}
