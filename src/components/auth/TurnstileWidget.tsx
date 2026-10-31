"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { onboardingLog } from "@/lib/onboarding-log";
import { loadTurnstile, turnstileLanguage, type TurnstileApi } from "@/lib/turnstile";

export type TurnstileStatus = "loading" | "verified" | "expired" | "error";

export type TurnstileHandle = {
  /** Asks Cloudflare for a fresh token (tokens are single use and expire after 300 s). */
  reset: () => void;
};

type TurnstileWidgetProps = {
  siteKey: string;
  /** `token` is set only while `status` is `verified`. */
  onChange: (status: TurnstileStatus, token: string | null) => void;
  ref?: Ref<TurnstileHandle>;
};

const TURNSTILE_NORMAL_WIDTH = 300;

/**
 * Cloudflare Turnstile widget, explicitly rendered into its own container. Reports the token through `onChange` and
 * shows localized loading / expired / error states with a retry. No Figma frame exists for it (docs/figma/design-gaps.md).
 */
export function TurnstileWidget({ siteKey, onChange, ref }: TurnstileWidgetProps) {
  const t = useTranslations("common.googleLogin");
  const locale = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<TurnstileApi | null>(null);
  const widgetIdRef = useRef<string | undefined>(undefined);
  const onChangeRef = useRef(onChange);
  const [status, setStatus] = useState<TurnstileStatus>("loading");
  // Bumped by retry when the script itself failed to load, so the effect re-injects it.
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let cancelled = false;
    const report = (next: TurnstileStatus, token: string | null = null) => {
      if (cancelled) return;
      setStatus(next);
      onChangeRef.current(next, token);
    };

    let observer: ResizeObserver | undefined;
    let debounce: number | undefined;
    let size: "normal" | "compact" | undefined;
    // Cloudflare's `normal` widget is a fixed 300px box: wider than the sign-in card on narrow phones, so it is clipped.
    const sizeFor = (container: HTMLElement) => (container.clientWidth > 0 && container.clientWidth < TURNSTILE_NORMAL_WIDTH ? "compact" : "normal");
    const renderWidget = (api: TurnstileApi, container: HTMLElement) => {
      size = sizeFor(container);
      widgetIdRef.current = api.render(container, {
        sitekey: siteKey,
        action: "login",
        language: turnstileLanguage(locale),
        theme: "auto",
        size,
        callback: (token) => report("verified", token),
        // The widget refreshes an expired token by itself (refresh-expired: auto); until then sign-in waits.
        "expired-callback": () => report("expired"),
        "timeout-callback": () => report("error"),
        "error-callback": (errorCode) => {
          onboardingLog("oauth.turnstile.error", { errorCode: errorCode ?? null });
          report("error");
          return true;
        },
      });
    };

    loadTurnstile()
      .then((api) => {
        if (cancelled || !containerRef.current) return;
        const container = containerRef.current;
        apiRef.current = api;
        renderWidget(api, container);
        // A rotation or resize that crosses the 300px line needs the other size: re-render (the old token is void).
        if (typeof ResizeObserver !== "undefined") {
          observer = new ResizeObserver(() => {
            window.clearTimeout(debounce);
            debounce = window.setTimeout(() => {
              if (cancelled || sizeFor(container) === size) return;
              if (widgetIdRef.current !== undefined) api.remove(widgetIdRef.current);
              report("loading");
              renderWidget(api, container);
            }, 150);
          });
          observer.observe(container);
        }
      })
      .catch(() => {
        onboardingLog("oauth.turnstile.load_failed");
        report("error");
      });

    return () => {
      cancelled = true;
      observer?.disconnect();
      window.clearTimeout(debounce);
      if (apiRef.current && widgetIdRef.current !== undefined) apiRef.current.remove(widgetIdRef.current);
      widgetIdRef.current = undefined;
    };
  }, [siteKey, locale, loadAttempt]);

  const reset = () => {
    setStatus("loading");
    onChangeRef.current("loading", null);
    if (apiRef.current && widgetIdRef.current !== undefined) apiRef.current.reset(widgetIdRef.current);
    else setLoadAttempt((attempt) => attempt + 1);
  };

  useImperativeHandle(ref, () => ({ reset }));

  return (
    <div className="mt-4">
      <div aria-label={t("turnstileLabel")} className="flex min-h-[65px] justify-center" ref={containerRef} role="group" />
      <p className="mt-2 text-center text-sm text-ink-muted" role="status">
        {status === "loading" ? t("turnstileVerifying") : status === "expired" ? t("turnstileExpired") : null}
      </p>
      {status === "error" ? (
        <div className="mt-2 text-center" role="alert">
          <p className="text-sm text-danger">{t("turnstileError")}</p>
          <button
            className="mt-2 text-sm font-semibold text-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            onClick={reset}
            type="button"
          >
            {t("turnstileRetry")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
