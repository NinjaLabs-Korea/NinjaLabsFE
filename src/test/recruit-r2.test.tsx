// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { CohortApplicationForm } from "@/components/recruit/CohortApplicationForm";
import { RecruitView } from "@/components/recruit/RecruitView";
import { RecruitmentBanner } from "@/components/recruit/RecruitmentBanner";
import { HeroSecondaryCta } from "@/components/community/HeroSecondaryCta";
import type { PublicCohort } from "@/lib/cohorts";
import { renderWithIntl } from "@/test/intl";
import { signedInWith } from "@/test/support/auth";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: Omit<ComponentProps<"a">, "href"> & { href: string }) => <a href={String(href)} {...props}>{children}</a>,
}));

type Mine = { id: string; cohortId: string; status: string; cohortName: string };
const auth = signedInWith({ onboardingCompleted: true });
let api: Record<string, unknown>;
vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({
    useAuthSnapshot: () => auth,
    useFoundationMode: () => "api" as const,
    useCohortApi: () => api,
    useAccountApi: () => api,
  }));

const cohort = (over: Partial<PublicCohort>): PublicCohort => ({ id: "c2", name: "Second", description: "", opensAt: null, closesAt: null, acceptingApplications: true, questions: [], ...over });
const application = (over: Partial<Mine>) => ({
  id: "a1", cohortId: "c1", cohort: { id: "c1", name: over.cohortName ?? "First", status: "CLOSED", acceptingApplications: false }, reviewedAt: null, editable: false, withdrawable: false, status: "ACCEPTED", displayName: "Kim", telegram: "kim", twitter: "kim", answers: [],
  intro: "hi", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", ...over, cohortName: undefined,
});
const available = (data: unknown[]) => async () => ({ status: "available", data });

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); };
});

beforeEach(() => {
  api = { getCurrentCohort: async () => null, getMyCohortApplications: available([application({})]) };
});

describe("RecruitView past applications", () => {
  it("lists my application when no cohort is open", async () => {
    renderWithIntl(<RecruitView aboutSlot={null} />);
    expect(await screen.findByText("Your earlier applications")).toBeTruthy();
    expect(screen.queryByText("Open the application page")).toBeNull();
    expect(screen.getByText("First")).toBeTruthy();
  });

  it("shows the form and the older application when a newer cohort is open", async () => {
    api.getCurrentCohort = async () => cohort({});
    renderWithIntl(<RecruitView aboutSlot={null} />);
    expect(await screen.findByRole("button", { name: "Send application" })).toBeTruthy();
    expect(await screen.findByText("Your earlier applications")).toBeTruthy();
    expect(screen.getByText("First")).toBeTruthy();
  });

  it("does not repeat the current cohort's application or withdrawn ones", async () => {
    api.getCurrentCohort = async () => cohort({ id: "c1", acceptingApplications: false });
    api.getMyCohortApplications = available([application({}), application({ id: "a0", cohortId: "c0", status: "WITHDRAWN", cohortName: "Zero" })]);
    renderWithIntl(<RecruitView aboutSlot={null} />);
    await act(async () => undefined);
    await act(async () => undefined);
    expect(screen.queryByText("Your earlier applications")).toBeNull();
    expect(screen.queryByText("Zero")).toBeNull();
  });
});

describe("CohortApplicationForm focus and visible text", () => {
  it("focuses the first invalid field on an empty submit", async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    renderWithIntl(<CohortApplicationForm cohortId="c" onSaved={() => undefined} />);
    fireEvent.submit(screen.getByRole("button", { name: "Send application" }).closest("form")!);
    await waitFor(() => expect(document.activeElement?.id).toBe("cohort-displayName"));
    expect(scroll).toHaveBeenCalled();
  });

  it("treats a zero-width-only name as empty", async () => {
    renderWithIntl(<CohortApplicationForm cohortId="c" onSaved={() => undefined} />);
    fireEvent.change(document.getElementById("cohort-displayName")!, { target: { value: "​​" } });
    fireEvent.change(document.getElementById("cohort-intro")!, { target: { value: "​" } });
    fireEvent.submit(document.querySelector("form")!);
    await act(async () => undefined);
    expect(document.getElementById("cohort-displayName-error")).toBeTruthy();
    expect(document.getElementById("cohort-intro-error")).toBeTruthy();
  });
});

describe("HeroSecondaryCta width", () => {
  it("lets the label wrap inside the hero", async () => {
    api = { getCurrentCohort: async () => cohort({ name: "Cohort" + "Z".repeat(54) }), getMyCohortApplications: available([]) };
    renderWithIntl(<HeroSecondaryCta className="x" fallbackHref="/n" fallbackLabel="f" />);
    await act(async () => undefined);
    await act(async () => undefined);
    const link = screen.getByRole("link");
    expect(link.className).toContain("max-w-full");
    expect(link.className).toContain("[overflow-wrap:anywhere]");
  });
});

describe("RecruitmentBanner reserve", () => {
  it("keeps an invisible box while the read is in flight when the tab hint says a cohort accepts", async () => {
    window.sessionStorage.setItem("ninja.cohortAccepting", "1");
    api = { getCurrentCohort: () => new Promise(() => undefined), getMyCohortApplications: available([]) };
    const view = renderWithIntl(<RecruitmentBanner />);
    await act(async () => undefined);
    expect(view.container.querySelector("section[aria-hidden=true] .invisible")).toBeTruthy();
    window.sessionStorage.clear();
  });

  it("renders nothing without a hint", async () => {
    window.sessionStorage.clear();
    api = { getCurrentCohort: () => new Promise(() => undefined), getMyCohortApplications: available([]) };
    const view = renderWithIntl(<RecruitmentBanner />);
    await act(async () => undefined);
    expect(view.container.textContent).toBe("");
  });
});
