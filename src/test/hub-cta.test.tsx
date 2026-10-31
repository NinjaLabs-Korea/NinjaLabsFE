// @vitest-environment jsdom
import { act, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StartLink } from "@/components/auth/StartLink";
import { HeroSecondaryCta } from "@/components/community/HeroSecondaryCta";
import type { PublicCohort } from "@/lib/cohorts";
import type { CohortApi } from "@/lib/contracts/api";
import { renderWithIntl } from "@/test/intl";
import { loading, signedInWith, signedOut } from "@/test/support/auth";

const state = vi.hoisted(() => ({ auth: null as unknown }));
let cohortApi: Pick<CohortApi, "getCurrentCohort" | "getMyCohortApplications">;
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: ComponentProps<"a">) => <a href={href} {...props}>{children}</a>,
}));
vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({ useAuthSnapshot: () => state.auth, useCohortApi: () => cohortApi }));

const cohort: PublicCohort = { id: "c1", name: "2nd cohort", description: "", opensAt: null, closesAt: null, acceptingApplications: true, questions: [] };
const unfinished = signedInWith({ onboardingCompleted: false, onboardingStep: 3 });
const finished = signedInWith({ onboardingCompleted: true, profileSlug: "pelican" });
const mine = (status: string, cohortId = "c1") => [{ id: "a1", cohortId, status }] as never;

beforeEach(() => {
  cohortApi = { getCurrentCohort: async () => cohort, getMyCohortApplications: vi.fn(async () => ({ status: "available" as const, data: [] })) };
});
afterEach(() => vi.restoreAllMocks());

describe("hub primary CTA (StartLink with the dashboard as the finished target)", () => {
  const cta = () => (
    <StartLink className="cta" memberHref="/home" memberLabel="My activity" resumeLabel="Continue sign-up" signUpLabel="Get Started" />
  );

  it.each([
    ["signed out", signedOut, "Get Started", "/signup"],
    ["onboarding incomplete", unfinished, "Continue sign-up", "/signup/profile"],
    ["finished", finished, "My activity", "/home"],
  ])("%s", (_name, snapshot, label, href) => {
    state.auth = snapshot;
    renderWithIntl(cta());
    const link = screen.getByRole("link", { name: label });
    expect(link.getAttribute("href")).toBe(href);
  });

  it("keeps its box but hides the label while the session is restored (no flash, no wrong link)", () => {
    state.auth = loading;
    const view = renderWithIntl(cta());
    expect(screen.queryByRole("link")).toBeNull();
    const placeholder = view.container.querySelector("span.invisible");
    expect(placeholder?.getAttribute("aria-hidden")).toBe("true");
    expect(placeholder?.className).toContain("cta");
  });

  it("without memberHref a finished user still gets their profile (the bounty hero keeps this)", () => {
    state.auth = finished;
    renderWithIntl(<StartLink className="cta" memberLabel="My profile" resumeLabel="r" signUpLabel="s" />);
    expect(screen.getByRole("link", { name: "My profile" }).getAttribute("href")).toBe("/members/pelican");
  });
});

describe("hub secondary CTA (HeroSecondaryCta)", () => {
  const view = () => renderWithIntl(<HeroSecondaryCta className="x" fallbackHref="/notices?category=events" fallbackLabel="See past activities" />);

  it("shows no label until the cohort read settles, then the apply link while a cohort accepts", async () => {
    state.auth = signedOut;
    view();
    expect(screen.queryByRole("link")).toBeNull();
    const apply = await screen.findByRole("link", { name: "Apply to join 2nd cohort" });
    expect(apply.getAttribute("href")).toBe("/recruit");
  });

  it("keeps the past activities link when no cohort accepts applications", async () => {
    cohortApi.getCurrentCohort = async () => ({ ...cohort, acceptingApplications: false });
    state.auth = signedOut;
    view();
    await act(async () => undefined);
    expect(screen.getByRole("link", { name: "See past activities" })).toBeTruthy();
  });

  it("does not read my applications for a signed-out or unfinished visitor", async () => {
    for (const snapshot of [signedOut, unfinished, loading]) {
      state.auth = snapshot;
      const rendered = view();
      await act(async () => undefined);
      rendered.unmount();
    }
    expect(cohortApi.getMyCohortApplications).not.toHaveBeenCalled();
  });

  it("offers Apply to a finished user who has not applied, and View my application once they did", async () => {
    state.auth = finished;
    const first = view();
    expect(await screen.findByRole("link", { name: "Apply to join 2nd cohort" })).toBeTruthy();
    first.unmount();

    cohortApi.getMyCohortApplications = vi.fn(async () => ({ status: "available" as const, data: mine("SUBMITTED") }));
    view();
    const status = await screen.findByRole("link", { name: "View my application" });
    expect(status.getAttribute("href")).toBe("/recruit");
    expect(screen.queryByRole("link", { name: /Apply to join/ })).toBeNull();
  });

  it("ignores a withdrawn application and an application to another cohort", async () => {
    state.auth = finished;
    cohortApi.getMyCohortApplications = vi.fn(async () => ({ status: "available" as const, data: [...mine("WITHDRAWN"), ...mine("SUBMITTED", "other")] }));
    view();
    expect(await screen.findByRole("link", { name: "Apply to join 2nd cohort" })).toBeTruthy();
  });

  it("never shows the apply label before the application read settles (it would flip to View my application)", async () => {
    state.auth = finished;
    let release: (value: never) => void = () => undefined;
    cohortApi.getMyCohortApplications = vi.fn(() => new Promise((resolve) => { release = resolve as never; })) as never;
    view();
    await act(async () => undefined);
    expect(screen.queryByRole("link", { name: /Apply to join|View my application/ })).toBeNull();
    await act(async () => release({ status: "available", data: mine("SUBMITTED") } as never));
    expect(screen.getByRole("link", { name: "View my application" })).toBeTruthy();
  });
});
