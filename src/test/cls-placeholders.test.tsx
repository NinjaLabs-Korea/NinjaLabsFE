// @vitest-environment jsdom
// Layout-shift guards: the loading placeholder and the resolved screen share one min-height wrapper, and the cohort seeds from the server.
import { renderHook, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountSettingsView } from "@/components/account/AccountSettingsView";
import { AdminGate } from "@/components/admin/AdminGate";
import { InitialCohortProvider, useCurrentCohort } from "@/components/recruit/useCurrentCohort";
import { SignupGate, SIGNUP_PLACEHOLDER_HEIGHT } from "@/components/signup/SignupGate";
import type { AuthSnapshot } from "@/lib/contracts/auth";
import type { PublicCohort } from "@/lib/cohorts";
import { renderWithIntl } from "@/test/intl";
import { loading, signedInWith, signedOut } from "@/test/support/auth";

const state = vi.hoisted(() => ({ auth: null as unknown, getCurrentCohort: null as unknown }));
const replace = vi.hoisted(() => vi.fn());
vi.mock("@/lib/flash", () => ({ pushFlash: vi.fn(), stashFlash: vi.fn() }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: ComponentProps<"a">) => <a href={href} {...props}>{children}</a>,
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => "/",
}));
vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({
    useAuthSnapshot: () => state.auth as AuthSnapshot,
    useAuthActions: () => ({ signIn: vi.fn(), signOut: vi.fn() }),
    useFoundationMode: () => "api",
    useAccountSettingsApi: () => ({}),
    useCohortApi: () => ({ getCurrentCohort: state.getCurrentCohort }),
  }));

const wrapperClass = (container: HTMLElement) => container.firstElementChild?.className ?? "";

beforeEach(() => {
  replace.mockClear();
});

describe("loading and resolved branches share the min-height wrapper", () => {
  it("AccountSettingsView: loading and signed-out are the same min-h-dvh container", () => {
    state.auth = loading;
    const first = renderWithIntl(<AccountSettingsView />);
    expect(wrapperClass(first.container)).toContain("min-h-dvh");
    first.unmount();
    state.auth = signedOut;
    const second = renderWithIntl(<AccountSettingsView />);
    expect(wrapperClass(second.container)).toContain("min-h-dvh");
    expect(second.container.firstElementChild?.tagName).toBe("DIV");
  });

  it("AdminGate: loading, signed-out, denied and the loaded console all sit in min-h-dvh", () => {
    const classes: string[] = [];
    for (const auth of [loading, signedOut, signedInWith({ isAdmin: false }), signedInWith({ isAdmin: true })]) {
      state.auth = auth;
      const view = renderWithIntl(<AdminGate><p>console</p></AdminGate>);
      classes.push(wrapperClass(view.container));
      view.unmount();
    }
    for (const className of classes) expect(className).toContain("min-h-dvh");
  });

  it("SignupGate: the placeholder reserves the step's height and a finished user leaves from it without seeing the content", () => {
    for (const step of [1, 2, 3, 4] as const) {
      state.auth = loading;
      const view = renderWithIntl(<SignupGate step={step}><p>step content</p></SignupGate>);
      expect(screen.queryByText("step content")).toBeNull();
      expect(view.getByTestId("signup-gate-placeholder").className).toBe(SIGNUP_PLACEHOLDER_HEIGHT[step]);
      view.unmount();
    }
    state.auth = loading;
    const withKey = renderWithIntl(<SignupGate step={1} withTurnstile><p>step content</p></SignupGate>);
    expect(withKey.getByTestId("signup-gate-placeholder").className).not.toBe(SIGNUP_PLACEHOLDER_HEIGHT[1]);
    withKey.unmount();
    state.auth = signedInWith({ onboardingCompleted: true });
    const finished = renderWithIntl(<SignupGate step={4}><p>step content</p></SignupGate>);
    expect(screen.queryByText("step content")).toBeNull();
    expect(finished.getByTestId("signup-gate-placeholder")).toBeTruthy();
  });
});

describe("useCurrentCohort seeds from the server cohort", () => {
  const cohort: PublicCohort = { id: "c1", name: "3rd", description: null, opensAt: null, closesAt: null, acceptingApplications: true };
  const wrapperFor = (value: PublicCohort | null | undefined) =>
    function Wrapper({ children }: { children: ReactNode }) {
      return <InitialCohortProvider cohort={value}>{children}</InitialCohortProvider>;
    };

  it("is ready on the first render when the server read an open cohort or none", () => {
    state.getCurrentCohort = vi.fn(() => new Promise(() => undefined));
    const open = renderHook(() => useCurrentCohort(), { wrapper: wrapperFor(cohort) });
    expect(open.result.current).toMatchObject({ status: "ready", cohort });
    const none = renderHook(() => useCurrentCohort(), { wrapper: wrapperFor(null) });
    expect(none.result.current).toMatchObject({ status: "ready", cohort: null });
  });

  it("stays loading when the server read failed (undefined)", () => {
    state.getCurrentCohort = vi.fn(() => new Promise(() => undefined));
    const failed = renderHook(() => useCurrentCohort(), { wrapper: wrapperFor(undefined) });
    expect(failed.result.current.status).toBe("loading");
  });
});
