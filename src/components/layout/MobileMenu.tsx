"use client";

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode, type SyntheticEvent } from "react";

/**
 * Header mobile menu: a progressive-enhancement `<details>` (works without JS) whose client behaviours are added here -
 * it closes on link or button click (sign out), on Escape (focus returns to the summary), and on a click outside.
 */
export function MobileMenu({ label, children }: { label: string; children: ReactNode }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const details = detailsRef.current;
    if (!open || !details) return;
    const closeOnOutsideMouseDown = (event: MouseEvent) => {
      if (!details.contains(event.target as Node)) details.open = false;
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      details.open = false;
      details.querySelector("summary")?.focus();
    };
    document.addEventListener("mousedown", closeOnOutsideMouseDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideMouseDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const closeOnLinkClick = (event: ReactMouseEvent<HTMLDetailsElement>) => {
    if ((event.target as HTMLElement).closest("a, button") && detailsRef.current) detailsRef.current.open = false;
  };

  return (
    <details
      className="relative md:hidden"
      onClick={closeOnLinkClick}
      onToggle={(event: SyntheticEvent<HTMLDetailsElement>) => setOpen(event.currentTarget.open)}
      ref={detailsRef}
    >
      <summary className="flex cursor-pointer list-none items-center whitespace-nowrap rounded-control px-2 py-3 text-sm sm:px-3 leading-[21px] font-semibold text-ink-secondary [&::-webkit-details-marker]:hidden">
        {label}
      </summary>
      {children}
    </details>
  );
}
