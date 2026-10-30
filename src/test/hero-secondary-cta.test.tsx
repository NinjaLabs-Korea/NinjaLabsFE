// @vitest-environment jsdom
import { act, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HeroSecondaryCta } from "@/components/community/HeroSecondaryCta";
import type { PublicCohort } from "@/lib/cohorts";
import { renderWithIntl } from "@/test/intl";
import { loading, signedInWith, signedOut } from "@/test/support/auth";

const state = vi.hoisted(() => ({ auth: null as unknown }));
let api: { getCurrentCohort: () => Promise<PublicCohort | null>; getMyCohortApplications: () => Promise<unknown> };
vi.mock("@/i18n/navigation", () => ({ Link: ({ children, href, ...props }: ComponentProps<"a">) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({ useAuthSnapshot: () => state.auth, useCohortApi: () => api }));

const cohort: PublicCohort = { id: "c1", name: "2nd", description: "", opensAt: null, closesAt: null, acceptingApplications: true };
beforeEach(() => {
  api = { getCurrentCohort: async () => cohort, getMyCohortApplications: async () => ({ status: "available", data: [{ id: "a", cohortId: "c1", status: "SUBMITTED" }] }) };
});

describe("HeroSecondaryCta labels", () => {
  it("renders no fallback link while the cohort read is in flight", () => {
    state.auth = signedOut;
    api.getCurrentCohort = () => new Promise(() => undefined);
    const view = renderWithIntl(<HeroSecondaryCta className="x" fallbackHref="/n" fallbackLabel="See past activities" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(view.container.querySelector("span.invisible[aria-hidden=true]")).toBeTruthy();
  });

  it("keeps the box while the session loads, then shows only the final label", async () => {
    state.auth = loading;
    const view = renderWithIntl(<HeroSecondaryCta className="x" fallbackHref="/n" fallbackLabel="See past activities" />);
    await act(async () => undefined);
    expect(screen.queryByRole("link")).toBeNull();
    expect(view.container.querySelector("span.invisible")).toBeTruthy();
  });

  it("shows only 'View my application' for a signed-in applicant", async () => {
    state.auth = signedInWith({ onboardingCompleted: true, profileSlug: "p" });
    const seen: string[] = [];
    const view = renderWithIntl(<HeroSecondaryCta className="x" fallbackHref="/n" fallbackLabel="See past activities" />);
    const observer = new MutationObserver(() => { for (const a of view.container.querySelectorAll("a")) seen.push(a.textContent ?? ""); });
    observer.observe(view.container, { childList: true, subtree: true, characterData: true });
    await act(async () => undefined);
    await act(async () => undefined);
    observer.disconnect();
    expect(screen.getByRole("link", { name: "View my application" })).toBeTruthy();
    expect(seen.filter((label) => label !== "View my application")).toEqual([]);
  });

  it("shows the fallback only when the read failed or no cohort accepts", async () => {
    state.auth = signedOut;
    api.getCurrentCohort = async () => { throw new Error("down"); };
    renderWithIntl(<HeroSecondaryCta className="x" fallbackHref="/n" fallbackLabel="See past activities" />);
    await act(async () => undefined);
    expect(screen.getByRole("link", { name: "See past activities" })).toBeTruthy();
  });
});
