import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

/** The four `common.notFound` strings the 404 content shows. */
export type NotFoundCopy = { title: string; description: string; home: string; browseBounties: string };

/**
 * Presentational 404 content shared by the server `NotFoundSection` and the client `RootNotFoundCopy`.
 * `locale` pins the link targets when the surrounding intl provider's locale is not the page's (root not-found).
 */
export function NotFoundContent({ copy, locale }: { copy: NotFoundCopy; locale?: Locale }) {
  return (
    <section className="mx-auto max-w-content px-6 py-24 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">404</p>
      <h1 className="mt-3 font-display text-4xl -tracking-[0.36px] sm:text-5xl sm:-tracking-[0.48px] text-ink">{copy.title}</h1>
      <p className="mt-4 text-lg text-ink-muted">{copy.description}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link className="rounded-control bg-primary px-5 py-3 text-sm font-semibold text-on-inverse hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href="/" locale={locale}>{copy.home}</Link>
        <Link className="rounded-control border border-primary-outline px-5 py-3 text-sm font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href="/bounties" locale={locale}>{copy.browseBounties}</Link>
      </div>
    </section>
  );
}
