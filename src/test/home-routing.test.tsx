// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeGate } from "@/components/home/HomeGate";
import { BrandLink } from "@/components/layout/BrandLink";
import { isFinishedUser, resolveHomeAccess } from "@/lib/auth-route";
import { renderWithIntl } from "@/test/intl";
import { loading, signedIn, signedInWith, signedOut } from "@/test/support/auth";

const state = vi.hoisted(() => ({ auth: null as unknown, mode: "api" as "api" | "mock" }));
const replace = vi.hoisted(() => vi.fn());
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: ComponentProps<"a">) => <a href={href} {...props}>{children}</a>,
  useRouter: () => ({ replace, push: vi.fn() }),
}));
vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({ useAuthSnapshot: () => state.auth, useFoundationMode: () => state.mode }));

const unfinished = signedInWith({ onboardingCompleted: false, onboardingStep: 3 });
const finished = signedInWith({ onboardingCompleted: true, profileSlug: "pelican" });

afterEach(() => {
  replace.mockReset();
  state.mode = "api";
});

describe("the dashboard routing rule (lib/auth-route.ts)", () => {
  it("treats only a signed-in user with a finished onboarding as a finished user", () => {
    expect(isFinishedUser(finished)).toBe(true);
    for (const snapshot of [loading, signedOut, unfinished, signedIn]) expect(isFinishedUser(snapshot)).toBe(false);
  });

  it.each([
    ["loading", loading, undefined, { kind: "wait" }],
    ["signed out", signedOut, undefined, { kind: "intro", href: "/" }],
    ["wallet step", signedInWith({ onboardingCompleted: false, onboardingStep: 2 }), undefined, { kind: "resume", href: "/signup/wallet" }],
    ["profile step", unfinished, undefined, { kind: "resume", href: "/signup/profile" }],
    ["finished", finished, undefined, { kind: "show" }],
    ["mock preview user without onboarding fields", signedIn, { preview: true }, { kind: "show" }],
  ])("home access: %s", (_name, snapshot, options, expected) => {
    expect(resolveHomeAccess(snapshot, options)).toEqual(expected);
  });
});

describe("BrandLink", () => {
  it("always points at the hub, whatever the session says", () => {
    for (const snapshot of [loading, signedOut, unfinished, finished]) {
      state.auth = snapshot;
      const view = render(<BrandLink className="x" label="Ninja Labs home">logo</BrandLink>);
      expect(screen.getByRole("link", { name: "Ninja Labs home" }).getAttribute("href")).toBe("/");
      view.unmount();
    }
  });
});

describe("HomeGate", () => {
  const gate = () => renderWithIntl(<HomeGate><p>secret home</p></HomeGate>);

  it("shows a neutral checking state while the session is restored, never the content", () => {
    state.auth = loading;
    gate();
    expect(screen.queryByText("secret home")).toBeNull();
    expect(screen.getByRole("status").textContent).toMatch(/Checking/);
    expect(replace).not.toHaveBeenCalled();
  });

  it("renders the content for a finished user", () => {
    state.auth = finished;
    gate();
    expect(screen.getByText("secret home")).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor to the hub (a soft navigation: nothing redirects the hub any more)", () => {
    state.auth = signedOut;
    gate();
    expect(screen.queryByText("secret home")).toBeNull();
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("sends an unfinished sign-up to the step it owes", () => {
    state.auth = unfinished;
    gate();
    expect(replace).toHaveBeenCalledWith("/signup/profile");
    expect(screen.queryByText("secret home")).toBeNull();
  });

  it("keeps the home reviewable for the mock preview user (no onboarding fields)", () => {
    state.mode = "mock";
    state.auth = signedIn;
    gate();
    expect(screen.getByText("secret home")).toBeTruthy();
  });

  it("does not flash content when the session flips to signed-out", async () => {
    state.auth = finished;
    const view = gate();
    state.auth = signedOut;
    await act(async () => view.rerender(<HomeGate><p>secret home</p></HomeGate>));
    expect(screen.queryByText("secret home")).toBeNull();
  });
});
