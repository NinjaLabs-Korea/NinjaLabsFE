// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";
import { createApiAuthAdapter } from "@/lib/api/auth-adapter";
import { resetSessionState } from "@/lib/api/http";
import { readRuntimeConfig, toPublicRuntimeConfig } from "@/lib/runtime/config";
import {
  loadTurnstile,
  resetTurnstileLoaderForTests,
  TURNSTILE_SCRIPT_URL,
  turnstileLanguage,
  type TurnstileApi,
  type TurnstileRenderOptions,
} from "@/lib/turnstile";
import { renderWithIntl } from "@/test/intl";

const signIn = vi.hoisted(() => vi.fn());
const foundation = vi.hoisted(() => ({ mode: "api" as "api" | "mock" }));

vi.mock("@/components/auth/FoundationProvider", () => ({
  useAuthActions: () => ({ signIn, signOut: vi.fn() }),
  useFoundationMode: () => foundation.mode,
}));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const SITE_KEY = "1x00000000000000000000AA";

/** Stand-in for Cloudflare's `window.turnstile` — tests drive the callbacks the real widget would call. */
function installFakeTurnstile() {
  const widgets: TurnstileRenderOptions[] = [];
  const api = {
    render: vi.fn((_container: HTMLElement, options: TurnstileRenderOptions) => {
      widgets.push(options);
      return `widget-${widgets.length}`;
    }),
    reset: vi.fn(),
    remove: vi.fn(),
  } satisfies TurnstileApi;
  window.turnstile = api;
  return { api, widgets, current: () => widgets[widgets.length - 1] };
}

beforeEach(() => {
  foundation.mode = "api";
  signIn.mockReset();
  signIn.mockReturnValue(new Promise(() => {}));
  resetTurnstileLoaderForTests();
  document.head.querySelectorAll("script[data-turnstile-loader]").forEach((node) => node.remove());
});
afterEach(() => {
  cleanup();
  delete window.turnstile;
  vi.unstubAllGlobals();
});

describe("Turnstile runtime config", () => {
  const base = { NINJA_DEPLOYMENT_TIER: "local", NINJA_RUNTIME_MODE: "mock", NINJA_APP_ORIGIN: "http://localhost:3000", NINJA_MOCK_SEED: "default" };

  it("is absent without NEXT_PUBLIC_TURNSTILE_SITE_KEY and public when set", () => {
    expect(readRuntimeConfig(base)).not.toHaveProperty("turnstileSiteKey");
    expect(readRuntimeConfig({ ...base, NEXT_PUBLIC_TURNSTILE_SITE_KEY: "  " })).not.toHaveProperty("turnstileSiteKey");
    const config = readRuntimeConfig({ ...base, NEXT_PUBLIC_TURNSTILE_SITE_KEY: ` ${SITE_KEY} ` });
    expect(config.turnstileSiteKey).toBe(SITE_KEY);
    expect(toPublicRuntimeConfig(config).turnstileSiteKey).toBe(SITE_KEY);
  });

  it("rejects a value that is not a site key", () => {
    expect(() => readRuntimeConfig({ ...base, NEXT_PUBLIC_TURNSTILE_SITE_KEY: "<script>" })).toThrow("NEXT_PUBLIC_TURNSTILE_SITE_KEY");
  });
});

describe("loadTurnstile", () => {
  it("injects the explicit-render script once and resolves with window.turnstile", async () => {
    const first = loadTurnstile();
    const second = loadTurnstile();
    const scripts = document.head.querySelectorAll<HTMLScriptElement>("script[data-turnstile-loader]");
    expect(scripts).toHaveLength(1);
    expect(scripts[0].src).toBe(TURNSTILE_SCRIPT_URL);
    expect(TURNSTILE_SCRIPT_URL).toBe("https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit");
    const { api } = installFakeTurnstile();
    scripts[0].dispatchEvent(new Event("load"));
    await expect(first).resolves.toBe(api);
    await expect(second).resolves.toBe(api);
  });

  it("forgets a failed load so a retry injects the script again", async () => {
    const failed = loadTurnstile();
    document.head.querySelector("script[data-turnstile-loader]")!.dispatchEvent(new Event("error"));
    await expect(failed).rejects.toThrow("failed to load");
    expect(document.head.querySelectorAll("script[data-turnstile-loader]")).toHaveLength(0);
    void loadTurnstile().catch(() => undefined);
    expect(document.head.querySelectorAll("script[data-turnstile-loader]")).toHaveLength(1);
  });

  it("maps app locales to Turnstile languages", () => {
    expect(turnstileLanguage("en")).toBe("en");
    expect(turnstileLanguage("ko")).toBe("ko");
    expect(turnstileLanguage("zh")).toBe("zh-cn");
  });
});

describe("GoogleLoginButton with Turnstile", () => {
  const button = () => screen.getByRole("button", { name: "Continue with Google" }) as HTMLButtonElement;

  it("without a site key renders no widget and signs in without a token (today's behavior)", async () => {
    const fake = installFakeTurnstile();
    renderWithIntl(<GoogleLoginButton />);
    expect(button().disabled).toBe(false);
    expect(screen.queryByRole("group", { name: "Human verification" })).toBeNull();
    fireEvent.click(button());
    await waitFor(() => expect(signIn).toHaveBeenCalledWith(undefined));
    expect(fake.api.render).not.toHaveBeenCalled();
  });

  it("mock mode ignores the site key: no widget, button enabled", async () => {
    foundation.mode = "mock";
    const fake = installFakeTurnstile();
    renderWithIntl(<GoogleLoginButton turnstileSiteKey={SITE_KEY} />);
    expect(button().disabled).toBe(false);
    expect(screen.queryByRole("group", { name: "Human verification" })).toBeNull();
    await act(async () => {});
    expect(fake.api.render).not.toHaveBeenCalled();
  });

  it("waits for the widget token, then passes it to signIn", async () => {
    const fake = installFakeTurnstile();
    renderWithIntl(<GoogleLoginButton turnstileSiteKey={SITE_KEY} />);
    expect(button().disabled).toBe(true);
    expect(screen.getByText("Checking that you're human…")).toBeTruthy();
    await waitFor(() => expect(fake.api.render).toHaveBeenCalledTimes(1));
    expect(fake.api.render.mock.calls[0][0]).toBe(screen.getByRole("group", { name: "Human verification" }));
    expect(fake.current()).toMatchObject({ sitekey: SITE_KEY, action: "login", language: "en" });

    act(() => fake.current().callback!("token-abc"));
    expect(button().disabled).toBe(false);
    expect(screen.queryByText("Checking that you're human…")).toBeNull();
    fireEvent.click(button());
    await waitFor(() => expect(signIn).toHaveBeenCalledWith({ turnstileToken: "token-abc" }));
  });

  it("an expired token disables sign-in with a localized notice until the widget refreshes", async () => {
    const fake = installFakeTurnstile();
    renderWithIntl(<GoogleLoginButton turnstileSiteKey={SITE_KEY} />);
    await waitFor(() => expect(fake.api.render).toHaveBeenCalled());
    act(() => fake.current().callback!("first"));
    act(() => fake.current()["expired-callback"]!());
    expect(button().disabled).toBe(true);
    expect(screen.getByText("Verification expired. Refreshing the check…")).toBeTruthy();
    act(() => fake.current().callback!("second"));
    fireEvent.click(button());
    await waitFor(() => expect(signIn).toHaveBeenCalledWith({ turnstileToken: "second" }));
  });

  it("a widget error shows a localized alert whose retry resets the widget", async () => {
    const fake = installFakeTurnstile();
    renderWithIntl(<GoogleLoginButton turnstileSiteKey={SITE_KEY} />);
    await waitFor(() => expect(fake.api.render).toHaveBeenCalled());
    let handled: boolean | void = false;
    act(() => { handled = fake.current()["error-callback"]!("300010"); });
    expect(handled).toBe(true);
    expect(screen.getByRole("alert").textContent).toContain("We couldn't verify that you're human.");
    expect(button().disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Retry check" }));
    expect(fake.api.reset).toHaveBeenCalledWith("widget-1");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("a blocked script shows the error state and retry re-injects it", async () => {
    renderWithIntl(<GoogleLoginButton turnstileSiteKey={SITE_KEY} />);
    const script = document.head.querySelector("script[data-turnstile-loader]")!;
    act(() => { script.dispatchEvent(new Event("error")); });
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Retry check" }));
    await waitFor(() => expect(document.head.querySelectorAll("script[data-turnstile-loader]")).toHaveLength(1));
    const fake = installFakeTurnstile();
    act(() => { document.head.querySelector("script[data-turnstile-loader]")!.dispatchEvent(new Event("load")); });
    await waitFor(() => expect(fake.api.render).toHaveBeenCalledTimes(1));
  });

  it("removes the widget on unmount", async () => {
    const fake = installFakeTurnstile();
    const view = renderWithIntl(<GoogleLoginButton turnstileSiteKey={SITE_KEY} />);
    await waitFor(() => expect(fake.api.render).toHaveBeenCalled());
    view.unmount();
    expect(fake.api.remove).toHaveBeenCalledWith("widget-1");
  });

  it("coming back from the bfcache re-arms the button and asks for a fresh token", async () => {
    const fake = installFakeTurnstile();
    renderWithIntl(<GoogleLoginButton turnstileSiteKey={SITE_KEY} />);
    await waitFor(() => expect(fake.api.render).toHaveBeenCalled());
    act(() => fake.current().callback!("spent"));
    fireEvent.click(button());
    await screen.findByRole("button", { name: "Starting Google sign-in…" });
    act(() => { window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true })); });
    expect(fake.api.reset).toHaveBeenCalledWith("widget-1");
    expect(button().disabled).toBe(true);
  });
});

describe("api auth adapter signIn", () => {
  beforeEach(() => {
    sessionStorage.clear();
    resetSessionState();
    vi.stubGlobal("crypto", webcrypto);
  });

  it.each([
    [{ turnstileToken: "token-abc" }, "token-abc"],
    [undefined, null],
  ])("forwards the widget token to GET /auth/google as turnstileToken (%j)", async (options, expected) => {
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    void createApiAuthAdapter("https://api.example").signIn(options);
    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
    const url = new URL(String(assign.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe("https://api.example/auth/google");
    expect(url.searchParams.get("codeChallenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(url.searchParams.get("turnstileToken")).toBe(expected);
  });
});
