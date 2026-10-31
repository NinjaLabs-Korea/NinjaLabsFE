"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "@/i18n/navigation";

/** The page-entrance token (`globals.css` `--animate-page-in`: opacity + 8px rise, `--motion-slow`); the reduce pair is kept even though the CSS safety net covers it. */
export const ROUTE_ENTER_CLASSES = ["animate-page-in", "motion-reduce:animate-none"] as const;

/** Set on `#main-content` from the click until the new pathname lands; `globals.css` dims it (opacity 0.5, `--motion-fast`). */
export const ROUTE_LEAVING_ATTR = "data-route-leaving";

/** A failed or cancelled navigation must never leave the page dimmed. */
export const ROUTE_LEAVING_TIMEOUT_MS = 8000;

/**
 * Whether this tab has painted a page yet. Module scope on purpose: a locale switch remounts the whole shell (and this
 * component), and that remount should animate like a navigation, while the very first page of the tab must not (the server
 * HTML is already on screen; animating it would only delay the first paint).
 */
let shownFirstPage = false;

/** Test seam: treat the next mount as the tab's first page again. */
export function resetRouteFadeForTests(): void {
  shownFirstPage = false;
}

/** A plain left click on an internal `<a>` that leads to a different pathname (not a new tab, download, hash jump or external link). */
function isInternalPathChange(event: MouseEvent): boolean {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  const target = event.target;
  if (!(target instanceof Element)) return false;
  const anchor = target.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return false;
  if (anchor.hasAttribute("download")) return false;
  const targetAttr = anchor.getAttribute("target");
  if (targetAttr && targetAttr !== "_self") return false;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  return url.pathname !== window.location.pathname;
}

/**
 * Page-change feedback on `#main-content`, in two halves.
 * Leaving: a click on an internal link to another path (or back/forward) sets `data-route-leaving` at once, so the old page
 * eases to a dim while the server answers (the response itself can take a while, and a frozen page reads as "nothing happened").
 * Entering: after the pathname changes (or a locale switch remounts the shell) `animate-page-in` plays on the existing
 * `<main>` instead of keying a wrapper by pathname: a key would remount every nested layout and drop its state.
 * Search-param changes (filters) keep their own fade, so only the pathname counts. Renders nothing.
 */
export function RouteFade() {
  const pathname = usePathname();
  const leavingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The raw location path of the last committed page, so a popstate can tell back/forward to another page from a hash move.
  const committedPath = useRef<string | null>(null);

  const clearLeaving = () => {
    if (leavingTimer.current) {
      clearTimeout(leavingTimer.current);
      leavingTimer.current = null;
    }
    document.getElementById("main-content")?.removeAttribute(ROUTE_LEAVING_ATTR);
  };

  useEffect(() => {
    const startLeaving = () => {
      const main = document.getElementById("main-content");
      if (!main) return;
      main.setAttribute(ROUTE_LEAVING_ATTR, "");
      if (leavingTimer.current) clearTimeout(leavingTimer.current);
      leavingTimer.current = setTimeout(clearLeaving, ROUTE_LEAVING_TIMEOUT_MS);
    };
    const onClick = (event: MouseEvent) => {
      if (isInternalPathChange(event)) startLeaving();
    };
    const onPopState = () => {
      if (committedPath.current !== null && window.location.pathname !== committedPath.current) startLeaving();
    };
    // Restored from the back/forward cache: the page was frozen mid-leave, so drop the dim.
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) clearLeaving();
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("pageshow", onPageShow);
      // A locale switch unmounts this component: the remounted shell animates in, so it must not stay dimmed.
      clearLeaving();
    };
  }, []);

  useEffect(() => {
    committedPath.current = window.location.pathname;
    clearLeaving();
    if (!shownFirstPage) {
      shownFirstPage = true;
      return;
    }
    const main = document.getElementById("main-content");
    if (!main) return;
    main.classList.remove(...ROUTE_ENTER_CLASSES);
    // Force a style flush so re-adding the class starts the animation again on a repeat navigation.
    void main.offsetWidth;
    main.classList.add(...ROUTE_ENTER_CLASSES);
    const clear = () => main.classList.remove(...ROUTE_ENTER_CLASSES);
    main.addEventListener("animationend", clear, { once: true });
    return () => main.removeEventListener("animationend", clear);
  }, [pathname]);

  return null;
}
