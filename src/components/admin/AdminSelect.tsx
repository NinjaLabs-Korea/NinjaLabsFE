"use client";

import { useEffect, useId, useRef, useState } from "react";

export function AdminSelect({
  label,
  options,
  value,
  onChange,
  formatOption = (option) => option,
  disabled = false,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  /** Maps an option value to its displayed (translated) label. */
  formatOption?: (option: string) => string;
  /** Shows the current value but does not open (a value the BE no longer accepts changes for). */
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => Math.max(options.indexOf(value), 0));
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxId = useId();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const openListbox = () => {
    setActiveIndex(Math.max(options.indexOf(value), 0));
    setOpen(true);
  };

  const selectOption = (option: string) => {
    onChange(option);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
        event.preventDefault();
        openListbox();
      }
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, options.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        selectOption(options[activeIndex]);
        break;
      case "Escape":
        event.preventDefault();
        setOpen(false);
        break;
    }
  };

  return (
    <div className="relative max-w-full min-w-0" ref={rootRef}>
      <button
        aria-activedescendant={open ? `${listboxId}-opt-${activeIndex}` : undefined}
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        role="combobox"
        aria-label={label}
        id={`${listboxId}-trigger`}
        className="flex h-[46px] w-full items-center justify-between rounded-control border border-border px-[17px] text-sm text-ink-secondary disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled}
        onBlur={() => setOpen(false)}
        onClick={() => (open ? setOpen(false) : openListbox())}
        onKeyDown={handleKeyDown}
        ref={triggerRef}
        type="button"
      >
        {/* min-w-0 + truncate: an unbroken option text (a URL or hash as a bounty title) must not widen the page. */}
        <span className="min-w-0 truncate">{formatOption(value)}</span>
        <span aria-hidden="true" className="ml-2 shrink-0">▾</span>
      </button>
      {open && (
        <ul aria-labelledby={`${listboxId}-trigger`} className="absolute z-30 mt-1 w-full rounded-tile border border-border bg-surface p-1 shadow-frame" id={listboxId} role="listbox">
          {options.map((option, index) => {
            const selected = value === option;
            const active = activeIndex === index;
            const className = selected
              ? `rounded-control px-3 py-2.5 text-left text-sm [overflow-wrap:anywhere] font-semibold bg-primary-soft text-primary-strong${active ? " outline outline-1 outline-primary-outline" : ""}`
              : `rounded-control px-3 py-2.5 text-left text-sm [overflow-wrap:anywhere]${active ? " bg-surface-subtle" : ""}`;

            return (
              <li
                aria-selected={selected}
                className={className}
                id={`${listboxId}-opt-${index}`}
                key={option}
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectOption(option);
                }}
                onMouseEnter={() => setActiveIndex(index)}
                role="option"
              >
                {formatOption(option)}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
