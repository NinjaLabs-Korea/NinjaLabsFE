// @vitest-environment jsdom
import { act, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecruitmentBanner } from "@/components/recruit/RecruitmentBanner";
import type { PublicCohort } from "@/lib/cohorts";
import { renderWithIntl } from "@/test/intl";
import { loading, signedInWith, signedOut } from "@/test/support/auth";

const state = vi.hoisted(() => ({ auth: null as unknown }));
let api: { getCurrentCohort: () => Promise<PublicCohort | null>; getMyCohortApplications: () => Promise<unknown> };
vi.mock("@/i18n/navigation", () => ({ Link: ({ children, href, ...props }: ComponentProps<"a">) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({ useAuthSnapshot: () => state.auth, useCohortApi: () => api }));

const cohort: PublicCohort = { id: "c1", name: "2nd", description: "", opensAt: null, closesAt: null, acceptingApplications: true, questions: [] };
const finished = signedInWith({ onboardingCompleted: true, profileSlug: "p" });
const mine = (status: string) => ({ status: "available", data: [{ id: "a", cohortId: "c1", status }] });

beforeEach(() => {
  api = { getCurrentCohort: async () => cohort, getMyCohortApplications: async () => mine("SUBMITTED") };
});

describe("RecruitmentBanner CTA", () => {
  it("says 'Apply now' to a signed-out visitor", async () => {
    state.auth = signedOut;
    renderWithIntl(<RecruitmentBanner />);
    expect((await screen.findByRole("link", { name: "Apply now" })).getAttribute("href")).toBe("/recruit");
  });

  it.each(["SUBMITTED", "ACCEPTED", "REJECTED"])("says 'View my application' once applied (%s)", async (status) => {
    state.auth = finished;
    api.getMyCohortApplications = async () => mine(status);
    renderWithIntl(<RecruitmentBanner />);
    expect((await screen.findByRole("link", { name: "View my application" })).getAttribute("href")).toBe("/recruit");
    expect(screen.queryByRole("link", { name: "Apply now" })).toBeNull();
  });

  it("keeps 'Apply now' for a finished member with no (or a withdrawn) application", async () => {
    state.auth = finished;
    api.getMyCohortApplications = async () => mine("WITHDRAWN");
    renderWithIntl(<RecruitmentBanner />);
    expect(await screen.findByRole("link", { name: "Apply now" })).toBeTruthy();
  });

  it("keeps the CTA box with no label while the session or applications load", async () => {
    state.auth = loading;
    const view = renderWithIntl(<RecruitmentBanner />);
    await act(async () => undefined);
    expect(screen.queryByRole("link")).toBeNull();
    expect(view.container.querySelector("span.invisible[aria-hidden=true]")).toBeTruthy();
  });
});
