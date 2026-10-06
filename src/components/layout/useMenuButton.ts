"use client";

import { useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";

type MenuItemElement = HTMLAnchorElement | HTMLButtonElement;

/**
 * 헤더 드롭다운(계정 메뉴, 언어 선택)이 함께 쓰는 APG menu button 동작.
 * 열기/닫기, 바깥 클릭·포커스 이탈 시 닫기, 방향키/Home/End/Escape/Tab 처리를 한 곳에서 맡는다.
 * 패널·항목 스타일은 `menuPanelClass` / `menuItemClass`를 쓴다 (docs/design.md "Header dropdown menu").
 */
export function useMenuButton(itemCount: number) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(MenuItemElement | null)[]>([]);
  // 다음 렌더 후 포커스를 옮길지 여부. rAF는 보이지 않는 탭에서 멈추므로 커밋 직후 effect에서 처리한다.
  const focusPending = useRef(false);
  const menuId = useId();

  const closeMenu = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) buttonRef.current?.focus();
  };

  const focusItem = (index: number) => {
    focusPending.current = true;
    setActiveIndex(index);
  };

  useEffect(() => {
    if (!open || !focusPending.current) return;
    focusPending.current = false;
    itemRefs.current[activeIndex]?.focus();
  }, [open, activeIndex]);

  const openMenu = (focusIndex = 0) => {
    setOpen(true);
    focusItem(focusIndex);
  };

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideMouseDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideMouseDown);
    return () => document.removeEventListener("mousedown", closeOnOutsideMouseDown);
  }, [open]);

  const onItemKeyDown = (event: KeyboardEvent<MenuItemElement>) => {
    const currentIndex = itemRefs.current.indexOf(event.currentTarget);
    const lastIndex = itemCount - 1;

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
    if (event.key === "ArrowDown") nextIndex = currentIndex === lastIndex ? 0 : currentIndex + 1;
    else if (event.key === "ArrowUp") nextIndex = currentIndex === 0 ? lastIndex : currentIndex - 1;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = lastIndex;

    if (nextIndex !== undefined) {
      event.preventDefault();
      focusItem(nextIndex);
    }
  };

  return {
    open,
    closeMenu,
    /** 감싸는 div에 펼쳐 넣는다: 포커스가 메뉴 밖으로 나가면 닫는다. */
    rootProps: {
      ref: rootRef,
      onBlur: (event: FocusEvent<HTMLDivElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget)) closeMenu();
      },
    },
    /** `initialIndex`: 열 때 포커스할 항목 (예: 현재 선택된 언어). */
    buttonProps: (initialIndex = 0) => ({
      ref: buttonRef,
      type: "button" as const,
      "aria-haspopup": "menu" as const,
      "aria-expanded": open,
      "aria-controls": menuId,
      onClick: () => (open ? closeMenu() : openMenu(initialIndex)),
      onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
          event.preventDefault();
          openMenu(initialIndex);
        }
      },
    }),
    menuProps: { id: menuId, role: "menu" as const },
    itemProps: (index: number) => ({
      ref: (element: MenuItemElement | null) => {
        itemRefs.current[index] = element;
      },
      tabIndex: activeIndex === index ? 0 : -1,
      onKeyDown: onItemKeyDown,
    }),
  };
}

/** 헤더 드롭다운 패널과 항목의 공통 스타일. */
export const menuPanelClass =
  "absolute right-0 top-full z-50 mt-2 rounded-tile border border-border bg-surface p-1.5 shadow-frame";
/** 항목 레이아웃·포커스만. 글자 굵기/색은 `menuItemClass`(기본) 또는 선택 상태처럼 호출부에서 정한다. */
export const menuItemBaseClass =
  "flex w-full items-center justify-between rounded-control px-3 py-2 text-left text-sm hover:bg-surface-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
export const menuItemClass = `${menuItemBaseClass} font-medium text-ink-secondary`;
