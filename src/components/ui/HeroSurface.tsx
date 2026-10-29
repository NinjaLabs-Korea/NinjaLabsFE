import type { ReactNode } from "react";

type HeroSurfaceProps = {
  /** Left column: eyebrow, headline, copy, calls to action. */
  children: ReactNode;
  /** Right column: the hero's visual (a glass card). */
  aside: ReactNode;
  /** A tall first-screen hero (the Intro) or the shorter masthead hero above a list (`/bounties`). */
  size?: "full" | "masthead";
};

/**
 * The inverse gradient hero surface shared by the Intro (`/`) and the top of `/bounties`: gradient + glow, a content-width
 * two-column grid (stacked below `lg`), text in the `on-inverse` tokens. Both heroes put their `<h1>` in `children`.
 */
export function HeroSurface({ children, aside, size = "full" }: HeroSurfaceProps) {
  const height = size === "full" ? "py-24 sm:py-28 lg:flex lg:min-h-[720px] lg:items-center" : "py-16 sm:py-20";
  return (
    <section className={`relative isolate overflow-hidden bg-[linear-gradient(160deg,var(--color-hero-from)_0%,var(--color-hero-via)_55%,var(--color-hero-to)_100%)] ${height}`}>
      <div className="pointer-events-none absolute -right-1/4 -top-1/4 h-[680px] w-[680px] bg-[radial-gradient(circle,var(--color-glow)_0%,transparent_70%)] opacity-30" />
      <div className="relative mx-auto grid w-full max-w-content grid-cols-1 gap-12 px-4 sm:px-6 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col justify-center">{children}</div>
        <div className="min-w-0 self-center">{aside}</div>
      </div>
    </section>
  );
}
