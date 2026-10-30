"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname } from "@/i18n/navigation";

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

const IGNORED_INPUT_TYPES = new Set(["search", "hidden", "file"]);
// /signup/profile keeps its own draft across a locale switch, so it never needs the guard.
const EXEMPT_PATH = /^\/signup\/profile(\/|$)/;

function isTrackable(target: EventTarget | null): target is Field {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement) {
    if (IGNORED_INPUT_TYPES.has(target.type)) return false;
  } else if (!(target instanceof HTMLTextAreaElement) && !(target instanceof HTMLSelectElement)) {
    return false;
  }
  if (!target.closest("#main-content form")) return false;
  return !target.closest("[role=search]");
}

/**
 * Remembers form fields the user typed into so the locale switcher can warn before the [locale] remount wipes them.
 * Fields are forgotten when their form is submitted or the route changes.
 */
export function useUnsavedInputGuard(): { hasUnsavedInput: () => boolean } {
  const pathname = usePathname();
  const fields = useRef(new Set<Field>());
  const exempt = EXEMPT_PATH.test(pathname);

  useEffect(() => {
    const touched = fields.current;
    const onInput = (event: Event) => {
      if (isTrackable(event.target)) touched.add(event.target);
    };
    const onSubmit = (event: Event) => {
      for (const field of [...touched]) if (field.form === event.target) touched.delete(field);
    };
    document.addEventListener("input", onInput, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("submit", onSubmit, true);
      touched.clear();
    };
  }, [pathname]);

  const hasUnsavedInput = useCallback(() => {
    if (exempt) return false;
    for (const field of fields.current) {
      if (!field.isConnected) continue;
      // A touched checkbox/radio always carries a value ("on"), so "touched and still mounted" is the signal.
      if (field instanceof HTMLInputElement && (field.type === "checkbox" || field.type === "radio")) return true;
      if (field.value !== "") return true;
    }
    return false;
  }, [exempt]);

  return { hasUnsavedInput };
}
