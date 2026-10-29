// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { CohortApplicationCard } from "@/components/recruit/CohortApplicationCard";
import { CohortApplicationForm } from "@/components/recruit/CohortApplicationForm";
import { RecruitView } from "@/components/recruit/RecruitView";
import { RecruitmentBanner } from "@/components/recruit/RecruitmentBanner";
import { ApiHttpError } from "@/lib/api/http";
import type { ApiClient } from "@/lib/contracts/api";
import type { AuthSnapshot } from "@/lib/contracts/auth";
import { createMockApiClient } from "@/lib/mocks/api-client";
import { previewUser } from "@/lib/mocks/fixtures";
import { peekReturnPath } from "@/lib/return-path";
import { renderWithIntl } from "@/test/intl";
import { signedInAs, signedInWith, signedOut } from "@/test/support/auth";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: Omit<ComponentProps<"a">, "href"> & { href: string | { pathname: string; query?: Record<string, string> } }) => (
    <a href={typeof href === "string" ? href : `${href.pathname}?${new URLSearchParams(href.query).toString()}`} {...props}>{children}</a>
  ),
}));

const state: { auth: AuthSnapshot; mode: "api" | "mock" } = { auth: signedInAs(previewUser), mode: "mock" };
let api: ApiClient;
vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({
    useAuthSnapshot: () => state.auth,
    useFoundationMode: () => state.mode,
    useCohortApi: () => api,
    useAccountApi: () => api,
  }));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); };
});
beforeEach(() => {
  api = createMockApiClient();
  state.auth = signedInAs(previewUser);
  state.mode = "mock";
});
afterEach(() => window.sessionStorage.clear());

const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const choose = (name: string) => fireEvent.click(screen.getByRole("radio", { name }));
const check = (name: string) => fireEvent.click(screen.getByRole("checkbox", { name }));

function fillForm() {
  type(/^Name/, "  Mina Park ");
  type(/^Telegram ID/, "https://t.me/mina_builds");
  type(/^X \(Twitter\) handle/, "mina_builds");
  choose("1-3 years");
  choose("Developer");
  check("Researcher");
  check("Developer");
  type(/^Introduction and motivation/, "I build tools for Injective builders.");
}

describe("CohortApplicationForm", () => {
  it("asks exactly the Tally questions with the Tally options", () => {
    renderWithIntl(<CohortApplicationForm cohortId="cohort-2" onSaved={vi.fn()} />);
    for (const label of [/^Name/, /^Telegram ID/, /^X \(Twitter\) handle/, /^Introduction and motivation/]) expect(screen.getByLabelText(label)).toBeTruthy();
    expect(screen.getAllByRole("radio", { name: /year/ }).map((radio) => radio.getAttribute("value"))).toEqual(["LT_1Y", "Y1_3", "GT_3Y"]);
    const activity = within(screen.getByRole("group", { name: /current activity/ })).getAllByRole("radio");
    expect(activity.map((radio) => radio.getAttribute("value"))).toEqual(["DEVELOPER", "CONTENT_CREATOR", "KOL", "COMMUNITY_MARKETING", "RESEARCHER", "BIZDEV", "STUDENT", "OTHER"]);
    const interests = within(screen.getByRole("group", { name: /Areas you want to join/ })).getAllByRole("checkbox");
    expect(interests.map((box) => box.getAttribute("value"))).toEqual(["DEVELOPER", "CONTENT_CREATOR", "KOL", "COMMUNITY_MARKETING", "RESEARCHER", "BIZDEV", "OTHER"]);
    expect(screen.getByText(/Write at least 100 characters \(up to 1000\)/)).toBeTruthy();
    expect((screen.getByLabelText(/^Introduction and motivation/) as HTMLTextAreaElement).maxLength).toBe(1000);
  });

  it("renders no error text or invalid marks on a pristine form", () => {
    renderWithIntl(<CohortApplicationForm cohortId="cohort-2" onSaved={vi.fn()} />);
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
    expect(document.querySelectorAll("[aria-invalid]")).toHaveLength(0);
    expect(screen.queryByText(/This field is required|Please choose an option/)).toBeNull();
  });

  it("shows a field's problem only after it is left, and clears it when fixed", () => {
    renderWithIntl(<CohortApplicationForm cohortId="cohort-2" onSaved={vi.fn()} />);
    const name = screen.getByLabelText(/^Name/);
    fireEvent.focus(name);
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
    fireEvent.blur(name);
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(name.getAttribute("aria-invalid")).toBe("true");
    type(/^Name/, "Mina");
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
    fireEvent.blur(screen.getByLabelText(/^Telegram ID/));
    expect(screen.getByText(/This field is required/)).toBeTruthy();
    const group = screen.getByRole("group", { name: /Web3 experience/ });
    fireEvent.blur(group);
    expect(screen.getByText("Please choose an option.")).toBeTruthy();
  });

  it("does not call the API for an empty form and marks every missing field", () => {
    const apply = vi.spyOn(api, "applyToCohort");
    renderWithIntl(<CohortApplicationForm cohortId="cohort-2" onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Send application" }));
    expect(apply).not.toHaveBeenCalled();
    expect(screen.getAllByRole("alert").length).toBeGreaterThanOrEqual(7);
    expect(screen.getByLabelText(/^Name/).getAttribute("aria-invalid")).toBe("true");
  });

  it("asks for the detail when 'Other' is chosen and only then", () => {
    renderWithIntl(<CohortApplicationForm cohortId="cohort-2" onSaved={vi.fn()} />);
    expect(screen.queryByLabelText(/Tell us what you do/)).toBeNull();
    choose("Other");
    expect(screen.getByLabelText(/Tell us what you do/)).toBeTruthy();
    expect(screen.queryByLabelText(/Tell us which area/)).toBeNull();
    check("Other");
    expect(screen.getByLabelText(/Tell us which area/)).toBeTruthy();
    choose("Student");
    expect(screen.queryByLabelText(/Tell us what you do/)).toBeNull();
  });

  it("sends normalized values once, even for several submit events in one tick", async () => {
    const apply = vi.spyOn(api, "applyToCohort");
    const onSaved = vi.fn();
    renderWithIntl(<CohortApplicationForm cohortId="cohort-2" onSaved={onSaved} />);
    fillForm();
    const form = screen.getByRole("button", { name: "Send application" }).closest("form") as HTMLFormElement;
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith("cohort-2", {
      displayName: "Mina Park", telegram: "@mina_builds", twitter: "@mina_builds", web3Experience: "Y1_3", activityType: "DEVELOPER",
      activityTypeOther: null, interestAreas: ["DEVELOPER", "RESEARCHER"], interestOther: null, intro: "I build tools for Injective builders.",
    });
  });

  it("shows the BE's reason, keeps the typed answers and reports a stale page", async () => {
    vi.spyOn(api, "applyToCohort").mockRejectedValue(new ApiHttpError(409, "COHORT_NOT_ACCEPTING"));
    const onStale = vi.fn();
    renderWithIntl(<CohortApplicationForm cohortId="cohort-2" onSaved={vi.fn()} onStale={onStale} />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Send application" }));
    expect((await screen.findByText(/not accepting applications right now/)).getAttribute("role")).toBe("alert");
    expect(onStale).toHaveBeenCalled();
    expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe("  Mina Park ");
  });

  it("maps a class-validator 400 to the named field", async () => {
    vi.spyOn(api, "applyToCohort").mockRejectedValue(new ApiHttpError(400, "VALIDATION_FAILED", ["telegram must be a valid Telegram username (5-32 letters, digits or _)"]));
    renderWithIntl(<CohortApplicationForm cohortId="cohort-2" onSaved={vi.fn()} />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Send application" }));
    await waitFor(() => expect(screen.getByLabelText(/^Telegram ID/).getAttribute("aria-invalid")).toBe("true"));
    expect(screen.getByText(/Check every field and try again/)).toBeTruthy();
  });

  it("edits an existing application with PATCH and prefills it", async () => {
    const created = await api.applyToCohort("cohort-2", {
      displayName: "Me", telegram: "@me_builds", twitter: "@me_x", web3Experience: "GT_3Y", activityType: "OTHER", activityTypeOther: "Designer",
      interestAreas: ["OTHER"], interestOther: "UX", intro: "hi",
    });
    const update = vi.spyOn(api, "updateCohortApplication");
    const onSaved = vi.fn();
    renderWithIntl(<CohortApplicationForm application={created} cohortId="cohort-2" onCancel={vi.fn()} onSaved={onSaved} />);
    expect((screen.getByLabelText(/Tell us what you do/) as HTMLInputElement).value).toBe("Designer");
    expect((screen.getByRole("radio", { name: "Over 3 years" }) as HTMLInputElement).checked).toBe(true);
    type(/^Introduction and motivation/, "changed");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(update).toHaveBeenCalledWith(created.id, expect.objectContaining({ intro: "changed" }));
  });
});

describe("RecruitmentBanner", () => {
  it("shows the cohort name and a link to the application page while a cohort accepts applications", async () => {
    renderWithIntl(<RecruitmentBanner />);
    expect(await screen.findByText("Ninja Labs 2nd cohort is recruiting members")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Apply now" }).getAttribute("href")).toBe("/recruit");
  });

  it("renders nothing without a cohort, when it is closed, or when the read fails", async () => {
    for (const setup of [
      () => { api.getCurrentCohort = async () => null; },
      () => { api.getCurrentCohort = async () => ({ id: "c", name: "x", description: null, opensAt: null, closesAt: null, acceptingApplications: false }); },
      () => { api.getCurrentCohort = async () => { throw new Error("down"); }; },
    ]) {
      setup();
      const view = renderWithIntl(<RecruitmentBanner />);
      await act(async () => undefined);
      expect(view.container.querySelector("section")).toBeNull();
      view.unmount();
    }
  });
});

describe("RecruitView", () => {
  const about = <p>about slot</p>;

  it("sends a signed-out visitor to sign-in with a return path, and shows what Ninja Labs does", async () => {
    state.auth = signedOut;
    renderWithIntl(<RecruitView aboutSlot={about} />);
    expect(await screen.findByText("Sign in to apply")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sign in and apply" }).getAttribute("href")).toBe("/signup?returnTo=%2Frecruit");
    expect(screen.getByText("about slot")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Ninja Labs 2nd cohort" })).toBeTruthy();
    expect(screen.queryByLabelText(/^Name/)).toBeNull();
  });

  it("explains a closed cohort to a signed-out visitor instead of asking them to sign in", async () => {
    state.auth = signedOut;
    api.getCurrentCohort = async () => ({ id: "c", name: "1st", description: null, opensAt: null, closesAt: null, acceptingApplications: false });
    renderWithIntl(<RecruitView aboutSlot={about} />);
    expect(await screen.findByText("Applications are closed.")).toBeTruthy();
    expect(screen.queryByText("Sign in to apply")).toBeNull();
  });

  it("says there is no cohort when none is open", async () => {
    api.getCurrentCohort = async () => null;
    renderWithIntl(<RecruitView aboutSlot={about} />);
    expect(await screen.findByText("No cohort is recruiting right now.")).toBeTruthy();
  });

  it("offers a retry when the cohort cannot be read", async () => {
    api.getCurrentCohort = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValue(null);
    renderWithIntl(<RecruitView aboutSlot={about} />);
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("No cohort is recruiting right now.")).toBeTruthy();
  });

  it("sends an unfinished sign-up to the step it owes and remembers to come back", async () => {
    state.mode = "api";
    state.auth = signedInWith({ onboardingCompleted: false, onboardingStep: 3 });
    renderWithIntl(<RecruitView aboutSlot={about} />);
    expect(await screen.findByText("Finish signing up first")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Continue sign-up" }).getAttribute("href")).toBe("/signup/profile");
    expect(peekReturnPath()).toBe("/recruit");
    expect(screen.queryByLabelText(/^Name/)).toBeNull();
  });

  it("walks a finished user through apply, edit and withdraw, then offers the form again", async () => {
    state.mode = "api";
    state.auth = signedInWith({ id: previewUser.id, onboardingCompleted: true });
    renderWithIntl(<RecruitView aboutSlot={about} />);
    expect(await screen.findByRole("button", { name: "Send application" })).toBeTruthy();
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Send application" }));

    expect(await screen.findByText(/Your application was sent/)).toBeTruthy();
    expect(await screen.findByText("Under review")).toBeTruthy();
    expect(await screen.findByText("Mina Park")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Edit application" }));
    type(/^Introduction and motivation/, "A better introduction.");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText(/Your application was updated/)).toBeTruthy();
    expect(await screen.findByText("A better introduction.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    fireEvent.click(within(screen.getByRole("alertdialog", { hidden: true })).getByRole("button", { name: "Withdraw application" }));
    expect(await screen.findByText(/You withdrew your earlier application/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send application" })).toBeTruthy();
  });

  it("shows the result of a decided application without actions, and never the reviewer's note", async () => {
    state.mode = "api";
    state.auth = signedInWith({ id: previewUser.id, onboardingCompleted: true });
    const created = await api.applyToCohort("cohort-2", {
      displayName: "Me", telegram: "@me_builds", twitter: "@me_x", web3Experience: "GT_3Y", activityType: "DEVELOPER", activityTypeOther: null,
      interestAreas: ["DEVELOPER"], interestOther: null, intro: "hi",
    });
    await api.reviewAdminCohortApplication(created.id, { decision: "ACCEPTED", note: "SECRET INTERNAL NOTE" });
    const view = renderWithIntl(<RecruitView aboutSlot={about} />);
    expect(await screen.findByText("Accepted")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Edit application" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Withdraw" })).toBeNull();
    expect(view.container.textContent).not.toContain("SECRET INTERNAL NOTE");
  });

  it("closes the form when the cohort stops accepting", async () => {
    state.mode = "api";
    state.auth = signedInWith({ id: previewUser.id, onboardingCompleted: true });
    await api.transitionAdminCohort("cohort-2", "CLOSED");
    renderWithIntl(<RecruitView aboutSlot={about} />);
    expect(await screen.findByText("No cohort is recruiting right now.")).toBeTruthy();
    expect(screen.queryByLabelText(/^Name/)).toBeNull();
  });
});

describe("CohortApplicationCard", () => {
  it("withdraws through a confirmation and tells the owner to re-read when the application is already gone", async () => {
    const created = await api.applyToCohort("cohort-2", {
      displayName: "Me", telegram: "@me_builds", twitter: "@me_x", web3Experience: "GT_3Y", activityType: "DEVELOPER", activityTypeOther: null,
      interestAreas: ["DEVELOPER"], interestOther: null, intro: "hi",
    });
    const mine = await api.getMyCohortApplications(signedInAs(previewUser));
    if (mine.status !== "available") throw new Error("unavailable");
    const onChanged = vi.fn();
    vi.spyOn(api, "withdrawCohortApplication").mockRejectedValueOnce(new ApiHttpError(409, "COHORT_APPLICATION_NOT_SUBMITTED"));
    renderWithIntl(<CohortApplicationCard application={mine.data[0]} onChanged={onChanged} variant="compact" />);
    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    fireEvent.click(within(screen.getByRole("alertdialog", { hidden: true })).getByRole("button", { name: "Withdraw application" }));
    expect(await screen.findByText(/already reviewed or withdrawn/)).toBeTruthy();
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(created.id).toBe(mine.data[0].id);
  });
});
