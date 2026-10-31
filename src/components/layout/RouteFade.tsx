"use client";

import { useEffect } from "react";
import { usePathname } from "@/i18n/navigation";

/** The existing content-fade token (`globals.css`); the reduce pair is kept even though the CSS safety net covers it. */
export const ROUTE_FADE_CLASSES = ["animate-fade-in", "motion-reduce:animate-none"] as const;

/**
 * Whether this tab has painted a page yet. Module scope on purpose: a locale switch remounts the whole shell (and this
 * component), and that remount should fade like a navigation, while the very first page of the tab must not (the server
 * HTML is already on screen; fading it would only delay the first paint).
 */
let shownFirstPage = false;

/** Test seam: treat the next mount as the tab's first page again. */
export function resetRouteFadeForTests(): void {
  shownFirstPage = false;
}

/**
 * Fades `#main-content` in after a client navigation or a locale switch, so the page body does not swap in one frame.
 * It restarts the class on the existing `<main>` instead of keying a wrapper by pathname: a key would remount every
 * nested layout and drop its state. Search-param changes (filters) keep their own fade, so only the pathname counts.
 * Renders nothing.
 */
export function RouteFade() {
  const pathname = usePathname();

  useEffect(() => {
    if (!shownFirstPage) {
      shownFirstPage = true;
      return;
    }
    const main = document.getElementById("main-content");
    if (!main) return;
    main.classList.remove(...ROUTE_FADE_CLASSES);
    // Force a style flush so re-adding the class starts the animation again on a repeat navigation.
    void main.offsetWidth;
    main.classList.add(...ROUTE_FADE_CLASSES);
    const clear = () => main.classList.remove(...ROUTE_FADE_CLASSES);
    main.addEventListener("animationend", clear, { once: true });
    return () => main.removeEventListener("animationend", clear);
  }, [pathname]);

  return null;
}
