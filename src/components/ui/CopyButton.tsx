"use client";

import { useEffect, useRef, useState } from "react";

type CopyButtonProps = {
  /** The text put on the clipboard. */
  value: string;
  /** Idle label, e.g. "Copy". */
  label: string;
  /** Shown for a moment after a successful copy. */
  copiedLabel: string;
  /** Shown when the clipboard is blocked or missing; the caller's text is selectable next to the button, so say "select it by hand". */
  failedLabel: string;
  /** Button look; the caller passes its own class string (admin and member screens differ). */
  className: string;
  /** Accessible name when the visible label alone is ambiguous (several buttons in one table), e.g. "Copy email of juho". */
  ariaLabel?: string;
};

const RESET_MS = 2000;

/**
 * Copy-to-clipboard button. The result is announced through a `role="status"` line (`copiedLabel` / `failedLabel`) and the
 * button text flips for 2 seconds. A missing `navigator.clipboard` (insecure origin, old browser) or a rejected write
 * (permission policy) shows `failedLabel` instead of failing silently, so the person knows to copy by hand.
 */
export function CopyButton({ value, label, copiedLabel, failedLabel, className, ariaLabel }: CopyButtonProps) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    let next: "copied" | "failed" = "copied";
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(value);
    } catch {
      next = "failed";
    }
    setState(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), RESET_MS);
  };

  return (
    <>
      <button aria-label={state === "idle" ? ariaLabel : undefined} className={className} onClick={() => void copy()} type="button">
        {state === "copied" ? copiedLabel : state === "failed" ? failedLabel : label}
      </button>
      <span className="sr-only" role="status">{state === "copied" ? copiedLabel : state === "failed" ? failedLabel : ""}</span>
    </>
  );
}
