import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("common.notFound");

  return (
    <section className="mx-auto max-w-content px-6 py-24 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">404</p>
      <h1 className="mt-3 font-display text-5xl -tracking-[0.48px] text-ink">{t("title")}</h1>
      <p className="mt-4 text-lg text-ink-muted">{t("description")}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link className="rounded-control bg-primary px-5 py-3 text-sm font-semibold text-on-inverse hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href="/">{t("home")}</Link>
        <Link className="rounded-control border border-primary-outline px-5 py-3 text-sm font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href="/bounties">{t("browseBounties")}</Link>
      </div>
    </section>
  );
}
