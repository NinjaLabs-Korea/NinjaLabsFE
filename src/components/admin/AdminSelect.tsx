"use client";

import { useEffect, useId, useRef, useState } from "react";

export function AdminSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
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
    <div className="relative" ref={rootRef}>
      <button
        aria-activedescendant={open ? `${listboxId}-opt-${activeIndex}` : undefined}
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        role="combobox"
        aria-label={label}
        className="flex h-[46px] w-full items-center justify-between rounded-control border border-border px-[17px] text-sm text-ink-secondary"
        onBlur={() => setOpen(false)}
        onClick={() => (open ? setOpen(false) : openListbox())}
        onKeyDown={handleKeyDown}
        ref={triggerRef}
        type="button"
      >
        {value}
        <span>▾</span>
      </button>
      {open && (
        <ul className="absolute z-30 mt-1 w-full rounded-tile border border-border bg-surface p-1 shadow-frame" id={listboxId} role="listbox">
          {options.map((option, index) => {
            const selected = value === option;
            const active = activeIndex === index;
            const className = selected
              ? `rounded-control px-3 py-2.5 text-left text-sm font-semibold bg-primary-soft text-primary-strong${active ? " outline outline-1 outline-primary-outline" : ""}`
              : `rounded-control px-3 py-2.5 text-left text-sm${active ? " bg-surface-subtle" : ""}`;

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
                {option}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
