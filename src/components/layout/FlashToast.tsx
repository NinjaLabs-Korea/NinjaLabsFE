"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), FLASH_TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [flash]);

  return (
    <>
      <div aria-live="polite" className="sr-only">
        {flash ? `${t(`${flash}.title`)} ${t(`${flash}.description`)}` : ""}
      </div>
      {flash ? (
        <div className="fixed right-4 bottom-4 z-[70] max-w-[calc(100vw-2rem)]">
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
