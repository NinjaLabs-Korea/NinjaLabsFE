import type { ReactNode } from "react";

/** The hero `<h1>`: the first part in `on-inverse`, the highlight in the glow gradient. Shared by the Intro and the bounty hero. */
export function HeroTitle({ children, highlight }: { children: ReactNode; highlight: ReactNode }) {
  return (
    <h1 className="mt-5 max-w-[552px] break-words font-display text-5xl -tracking-[0.6px] text-on-inverse sm:text-hero">
      {children}{" "}
      <span className="bg-[linear-gradient(90deg,var(--color-glow)_0%,var(--color-accent-soft)_55%,var(--color-primary-outline)_100%)] bg-clip-text text-transparent">
        {highlight}
      </span>
    </h1>
  );
}
