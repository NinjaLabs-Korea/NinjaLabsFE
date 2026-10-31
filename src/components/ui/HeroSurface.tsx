import type { ReactNode } from "react";

type HeroSurfaceProps = {
  /** Left column: eyebrow, headline, copy, calls to action. */
  children: ReactNode;
  /** Right column: the hero's visual (a glass card). */
  aside: ReactNode;
};

/**
 * The inverse gradient hero surface of the hub (`/`, `community/CommunityHero`): gradient + glow, a tall first screen, a
 * content-width two-column grid (stacked below `lg`), text in the `on-inverse` tokens. The hero puts its `<h1>` in
 * `children`. Reserved for the hub: list pages such as `/bounties` use the light masthead (`ui/SectionHeader` level 1).
 */
export function HeroSurface({ children, aside }: HeroSurfaceProps) {
  return (
    <section className="relative isolate overflow-hidden bg-[linear-gradient(160deg,var(--color-hero-from)_0%,var(--color-hero-via)_55%,var(--color-hero-to)_100%)] py-24 sm:py-28 lg:flex lg:min-h-[720px] lg:items-center">
      <div className="pointer-events-none absolute -right-1/4 -top-1/4 h-[680px] w-[680px] bg-[radial-gradient(circle,var(--color-glow)_0%,transparent_70%)] opacity-30" />
      <div className="relative mx-auto grid w-full max-w-content grid-cols-1 gap-12 px-gutter lg:grid-cols-2">
        <div className="flex min-w-0 flex-col justify-center">{children}</div>
        <div className="min-w-0 self-center">{aside}</div>
      </div>
    </section>
  );
}
