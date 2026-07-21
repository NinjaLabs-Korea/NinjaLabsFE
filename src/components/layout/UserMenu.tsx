"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useAuthActions, useAuthSnapshot } from "@/components/auth/FoundationProvider";
import type { ClientUser } from "@/lib/contracts/auth";

export function getAccountNavigationItems(user: Pick<ClientUser, "profileSlug">) {
  return [
    { label: "My profile", href: `/members/${user.profileSlug}` },
    { label: "My applications", href: "/applications" },
    { label: "My agents", href: "/agents" },
  ];
}

export function UserMenu() {
  const snapshot = useAuthSnapshot();
  const { signOut } = useAuthActions();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | HTMLButtonElement | null)[]>([]);
  const menuId = useId();
  const user = snapshot.status === "signed-in" ? snapshot.user : null;
  const menuItems = user ? getAccountNavigationItems(user) : [];

  const closeMenu = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) {
      buttonRef.current?.focus();
    }
  };

  const focusMenuItem = (index: number) => {
    setActiveIndex(index);
    window.requestAnimationFrame(() => itemRefs.current[index]?.focus());
  };

  const openMenu = (focusIndex: number) => {
    setActiveIndex(focusIndex);
    setOpen(true);
    window.requestAnimationFrame(() => itemRefs.current[focusIndex]?.focus());
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    const closeOnOutsideMouseDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeMenu();
      }
    };

    document.addEventListener("mousedown", closeOnOutsideMouseDown);
    return () => document.removeEventListener("mousedown", closeOnOutsideMouseDown);
  }, [open]);

  const handleButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
      event.preventDefault();
      openMenu(0);
    }
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLAnchorElement | HTMLButtonElement>) => {
    const currentIndex = itemRefs.current.indexOf(event.currentTarget);
    const lastIndex = menuItems.length;

    if (event.key === "Tab") {
      closeMenu();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
      return;
    }

    let nextIndex: number | undefined;
    if (event.key === "ArrowDown") {
      nextIndex = currentIndex === lastIndex ? 0 : currentIndex + 1;
    } else if (event.key === "ArrowUp") {
      nextIndex = currentIndex === 0 ? lastIndex : currentIndex - 1;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = lastIndex;
    }

    if (nextIndex !== undefined) {
      event.preventDefault();
      focusMenuItem(nextIndex);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          closeMenu();
        }
      }}
      ref={rootRef}
    >
      <button
        aria-controls={menuId}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`flex items-center gap-2.5 rounded-full border bg-surface py-1 pl-1 pr-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary${open ? " border-primary-outline" : " border-border"}`}
        onClick={() => (open ? closeMenu() : openMenu(0))}
        onKeyDown={handleButtonKeyDown}
        ref={buttonRef}
        type="button"
      >
        <span className="grid size-8 place-items-center rounded-full bg-primary-soft-border font-display text-[13px] font-bold text-primary-strong">
          {user.initials}
        </span>
        <span className="text-sm font-semibold text-ink">{user.handle}</span>
        <span aria-hidden="true" className="text-xs text-ink-muted">{open ? "▴" : "▾"}</span>
      </button>

      {open ? (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-56 rounded-tile border border-border bg-surface p-1.5 shadow-frame"
          id={menuId}
          role="menu"
        >
          <div className="border-b border-border px-3 pt-2.5 pb-2">
            <p className="text-sm font-semibold text-ink">{user.handle}</p>
            <p className="text-xs text-ink-muted">Session preview{user.walletAddress ? ` · ${user.walletAddress}` : ""}</p>
          </div>
          <div className="pt-1.5">
            {menuItems.map((item, index) => (
              <Link
                className="flex items-center justify-between rounded-control px-3 py-2 text-sm font-medium text-ink-secondary hover:bg-surface-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                href={item.href}
                key={item.label}
                onKeyDown={handleMenuKeyDown}
                ref={(element) => {
                  itemRefs.current[index] = element;
                }}
                role="menuitem"
                tabIndex={activeIndex === index ? 0 : -1}
              >
                {item.label}
              </Link>
            ))}
            <div className="my-1.5 border-t border-border" />
            <button
              className="w-full rounded-control px-3 py-2 text-left text-sm font-semibold text-danger hover:bg-danger-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              onClick={() => {
                void signOut();
                closeMenu();
              }}
              onKeyDown={handleMenuKeyDown}
              ref={(element) => {
                itemRefs.current[menuItems.length] = element;
              }}
              role="menuitem"
              tabIndex={activeIndex === menuItems.length ? 0 : -1}
              type="button"
            >
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
