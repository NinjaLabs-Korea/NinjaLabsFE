/**
 * `scrollIntoView` that respects `prefers-reduced-motion`: smooth by default, an instant jump when the visitor asked for less motion.
 * (The CSS `scroll-behavior: auto !important` safety net does not reach a JS-requested `behavior: "smooth"`.)
 * Safe without `window`/`matchMedia` (SSR, old test environments): falls back to smooth.
 */
export function scrollIntoViewRespectingMotion(element: Element | null | undefined, options: Omit<ScrollIntoViewOptions, "behavior"> = {}): void {
  if (!element) return;
  const reduce = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  element.scrollIntoView({ ...options, behavior: reduce ? "auto" : "smooth" });
}
