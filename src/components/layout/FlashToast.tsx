"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { Toast } from "@/components/ui/Toast";
import { FAILURE_FLASH_KEYS, FLASH_EVENT, takeFlash, type FlashKey } from "@/lib/flash";

/** How long a flash stays up before it dismisses itself. */
export const FLASH_TOAST_MS = 6000;

/**
 * Shell-level host for the one-shot flash toast (`lib/flash.ts`). Rendered once by AppShell so it survives client
 * navigations: it picks up a flash left in sessionStorage on mount and any `ninja:flash` event afterwards.
 * Non-danger toasts carry no live role themselves (see `ui/Toast`), so this host keeps a persistent polite region.
 */
export function FlashToast() {
  const t = useTranslations("common.flash");
  const [flash, setFlash] = useState<FlashKey | null>(null);

  useEffect(() => {
    // Deferred so the initial render matches the server HTML (no flash there).
    const initial = window.setTimeout(() => {
      const pending = takeFlash();
      if (pending) setFlash(pending);
    }, 0);
    const onFlash = () => {
      const pending = takeFlash();
      if (pending) setFlash(pending);
    };
    window.addEventListener(FLASH_EVENT, onFlash);
    return () => {
      window.clearTimeout(initial);
      window.removeEventListener(FLASH_EVENT, onFlash);
    };
  }, []);

  // Pausable auto-dismiss: hovering or focusing the toast stops the clock, leaving resumes with the time that was left.
  const remaining = useRef(FLASH_TOAST_MS);
  const startedAt = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  const resume = useCallback(() => {
    window.clearTimeout(timer.current);
    startedAt.current = Date.now();
    timer.current = window.setTimeout(() => setFlash(null), remaining.current);
  }, []);

  const pause = useCallback(() => {
    if (timer.current === undefined) return;
    window.clearTimeout(timer.current);
    timer.current = undefined;
    remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
  }, []);

  useEffect(() => {
    if (!flash) return;
    remaining.current = FLASH_TOAST_MS;
    resume();
    return () => {
      window.clearTimeout(timer.current);
      timer.current = undefined;
    };
  }, [flash, resume]);

  // Pointer and focus both hold the toast; resume only once neither is left on it.
  const pointerInside = useRef(false);
  const focusInside = useRef(false);
  const settle = () => {
    if (pointerInside.current || focusInside.current) pause();
    else if (timer.current === undefined) resume();
  };

  return (
    <>
      <div aria-live="polite" className="sr-only">
        {flash ? `${t(`${flash}.title`)} ${t(`${flash}.description`)}` : ""}
      </div>
      {flash ? (
        <div
          className="fixed inset-x-4 bottom-4 z-[70] sm:inset-x-auto sm:right-4 sm:max-w-[calc(100vw-2rem)]"
          onBlur={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
            focusInside.current = false;
            settle();
          }}
          onFocus={() => {
            focusInside.current = true;
            settle();
          }}
          onPointerEnter={() => {
            pointerInside.current = true;
            settle();
          }}
          onPointerLeave={() => {
            pointerInside.current = false;
            settle();
          }}
        >
          <Toast
            description={t(`${flash}.description`)}
            onDismiss={() => setFlash(null)}
            title={t(`${flash}.title`)}
            variant={FAILURE_FLASH_KEYS.includes(flash) ? "danger" : "success"}
          />
        </div>
      ) : null}
    </>
  );
}
