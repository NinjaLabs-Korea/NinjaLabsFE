/**
 * Cloudflare Turnstile loader (explicit rendering). The script is loaded once per page from Cloudflare — it must not be
 * bundled or proxied (https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/). The CSP in
 * `next.config.ts` allows https://challenges.cloudflare.com in script-src, frame-src and connect-src.
 */
export const TURNSTILE_SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export type TurnstileRenderOptions = {
  sitekey: string;
  action?: string;
  language?: string;
  theme?: "auto" | "light" | "dark";
  callback?: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: (errorCode?: string) => boolean | void;
  "timeout-callback"?: () => void;
};

export type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string | undefined;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<TurnstileApi> | null = null;

/** Resolves with `window.turnstile`, injecting the script on first use. A failed load is forgotten so a retry re-injects it. */
export function loadTurnstile(): Promise<TurnstileApi> {
  if (typeof window === "undefined") return Promise.reject(new Error("Turnstile needs a browser"));
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loading) return loading;

  loading = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.dataset.turnstileLoader = "";
    script.addEventListener("load", () => {
      if (window.turnstile) resolve(window.turnstile);
      else fail(new Error("Turnstile script loaded without window.turnstile"));
    });
    script.addEventListener("error", () => fail(new Error("Turnstile script failed to load")));
    document.head.appendChild(script);

    function fail(error: Error) {
      script.remove();
      loading = null;
      reject(error);
    }
  });
  return loading;
}

/** Turnstile `language` for an app locale (zh → zh-cn; Turnstile has no bare `zh`). */
export function turnstileLanguage(locale: string): string {
  return locale === "zh" ? "zh-cn" : locale;
}

/** Test-only: forget a cached load between test cases. */
export function resetTurnstileLoaderForTests(): void {
  loading = null;
}
