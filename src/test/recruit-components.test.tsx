// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { CohortApplicationCard } from "@/components/recruit/CohortApplicationCard";
import { CohortApplicationForm } from "@/components/recruit/CohortApplicationForm";
import { RecruitView } from "@/components/recruit/RecruitView";
import { RecruitmentBanner } from "@/components/recruit/RecruitmentBanner";
import { ApiHttpError } from "@/lib/api/http";
import type { CohortQuestionInput } from "@/lib/cohorts";
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

/** The form reads the cohort's questions itself: wait until they have rendered. */
const formReady = () => screen.findByRole("radiogroup", { name: /Web3 experience/ });

function fillForm() {
  type(/^Name/, "  Mina Park ");
  type(/^Telegram ID/, "https://t.me/mina_builds");
  type(/^X \(Twitter\) handle/, "mina_builds");
  choose("1-3 years");
  check("Researcher");
  check("Developer");
  type(/^Introduction and motivation/, "I build tools for Injective builders.");
}

describe("CohortApplicationForm", () => {
  it("asks the four fixed fields, then the cohort's questions in their order, with their options", async () => {
    renderWithIntl(<CohortApplicationForm cohortId="cohort-2" onSaved={vi.fn()} />);
    await formReady();
    for (const label of [/^Name/, /^Telegram ID/, /^X \(Twitter\) handle/, /^Introduction and motivation/]) expect(screen.getByLabelText(label)).toBeTruthy();
    expect(screen.getAllByRole("radio", { name: /year/ }).map((radio) => radio.getAttribute("value"))).toEqual(["LT_1Y", "Y1_3", "GT_3Y"]);
    expect(screen.queryByRole("radiogroup", { name: /current activity/ })).toBeNull();
    const interests = within(screen.getByRole("group", { name: /Areas you want to join/ })).getAllByRole("checkbox");
    expect(interests.map((box) => box.getAttribute("value"))).toEqual(["DEVELOPER", "CONTENT_CREATOR", "KOL", "COMMUNITY_MARKETING", "RESEARCHER", "BIZDEV", "OTHER"]);
    const order = [...document.querySelectorAll("label, legend")].map((node) => node.textContent ?? "");
    expect(order.findIndex((text) => text.startsWith("Introduction"))).toBeLessThan(order.findIndex((text) => text.startsWith("Web3 experience")));
    expect(screen.getByText(/Write at least 100 characters \(up to 1000\)/)).toBeTruthy();
    expect((screen.getByLabelText(/^Introduction and motivation/) as HTMLTextAreaElement).maxLength).toBe(1000);
  });

  describe("configured questions", () => {
    const lt = (ko: string, en: string | null = null) => ({ ko, en, zh: null });
    const inputs: CohortQuestionInput[] = [
      { type: "SHORT_TEXT", label: lt("한 줄", "One line"), help: null, required: true, options: null },
      { type: "LONG_TEXT", label: lt("긴 글", "Long text"), help: lt("도움말", "Some help"), required: false, options: null },
      { type: "SINGLE_CHOICE", label: lt("하나", "Pick one"), help: null, required: true, options: [{ label: lt("가", "Alpha"), withDetail: false }, { label: lt("나", null), withDetail: true }] },
      { type: "MULTI_CHOICE", label: lt("여럿", "Pick several"), help: null, required: false, options: [{ label: lt("엑스", "Ex"), withDetail: false }, { label: lt("와이", "Why"), withDetail: false }] },
    ];
    /** The operator configures the cohort (the mock keeps the BE's rules and generated ids). Returns the stored questions. */
    const withQuestions = async () => (await api.saveAdminCohortQuestions("cohort-2", inputs)).questions;

    it("renders every question type in order, in the viewer's language with Korean as the fallback", async () => {
      const stored = await withQuestions();
      renderWithIntl(<CohortApplicationForm cohortId="cohort-2" onSaved={vi.fn()} />);
      await screen.findByLabelText(/^One line/);
      const labels = [...document.querySelectorAll("form label, form legend")].map((node) => node.textContent?.replace("*", "") ?? "").filter((text) => /One line|Long text|Pick one|Pick several/.test(text));
      expect(labels).toEqual(["One line", "Long text", "Pick one", "Pick several"]);
      expect(screen.getByLabelText(/^One line/).tagName).toBe("INPUT");
      expect((screen.getByLabelText(/^One line/) as HTMLInputElement).maxLength).toBe(200);
      expect(screen.getByLabelText(/^Long text/).tagName).toBe("TEXTAREA");
      expect((screen.getByLabelText(/^Long text/) as HTMLTextAreaElement).maxLength).toBe(2000);
      expect(screen.getByText("Some help")).toBeTruthy();
      expect(screen.getByText("0/2000")).toBeTruthy();
      expect(screen.getByRole("radio", { name: "Alpha" })).toBeTruthy();
      expect(screen.getByRole("radio", { name: "나" })).toBeTruthy();
      expect(screen.getAllByRole("checkbox").map((box) => box.getAttribute("value"))).toEqual(stored[3].options!.map((option) => option.id));
    });

    it("blocks the submit on a missing required answer, then sends the CONTRACT A5 body", async () => {
      const stored = await withQuestions();
      const apply = vi.spyOn(api, "applyToCohort");
      const onSaved = vi.fn();
      renderWithIntl(<CohortApplicationForm cohortId="cohort-2" onSaved={onSaved} />);
      await screen.findByLabelText(/^One line/);
      type(/^Name/, "Mina");
      type(/^Telegram ID/, "mina_builds");
      type(/^X \(Twitter\) handle/, "mina_builds");
      type(/^Introduction and motivation/, "hello");
      fireEvent.click(screen.getByRole("button", { name: "Send application" }));
      expect(apply).not.toHaveBeenCalled();
      expect(screen.getByLabelText(/^One line/).getAttribute("aria-invalid")).toBe("true");
      expect(screen.getByRole("radiogroup", { name: /Pick one/ }).getAttribute("aria-invalid")).toBe("true");

      type(/^One line/, "  because  ");
      type(/^Long text/, "line 1\nline 2");
      choose("나");
      expect(screen.getByLabelText(/Tell us more/)).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Send application" }));
      expect(apply).not.toHaveBeenCalled();
      expect(screen.getByLabelText(/Tell us more/).getAttribute("aria-invalid")).toBe("true");
      type(/Tell us more/, " Designer ");
      check("Why");
      check("Ex");
      fireEvent.click(screen.getByRole("button", { name: "Send application" }));
      await waitFor(() => expect(onSaved).toHaveBeenCalled());
      expect(apply).toHaveBeenCalledWith("cohort-2", {
        displayName: "Mina", telegram: "@mina_builds", twitter: "@mina_builds", intro: "hello",
        answers: [
          { questionId: stored[0].id, text: "because" },
          { questionId: stored[1].id, text: "line 1\nline 2" },
          { questionId: stored[2].id, choices: [stored[2].options![1].id], other: "Designer" },
          { questionId: stored[3].id, choices: stored[3].options!.map((option) => option.id) },
        ],
      });
    });

    it("reloads the cohort and keeps what was typed when the BE says the questions changed", async () => {
      await withQuestions();
      vi.spyOn(api, "applyToCohort").mockRejectedValueOnce(new ApiHttpError(400, "COHORT_ANSWERS_INVALID"));
      const read = vi.spyOn(api, "getCurrentCohort");
      const onStale = vi.fn();
      renderWithIntl(<CohortApplicationForm cohortId="cohort-2" onSaved={vi.fn()} onStale={onStale} />);
      await screen.findByLabelText(/^One line/);
      type(/^Name/, "Mina");
      type(/^Telegram ID/, "mina_builds");
      type(/^X \(Twitter\) handle/, "mina_builds");
      type(/^Introduction and motivation/, "hello");
      type(/^One line/, "because");
      choose("Alpha");
      const before = read.mock.calls.length;
      fireEvent.click(screen.getByRole("button", { name: "Send application" }));
      expect(await screen.findByText("The application questions changed. Please check the new questions and send again.")).toBeTruthy();
      await waitFor(() => expect(read.mock.calls.length).toBeGreaterThan(before));
      expect((screen.getByLabelText(/^One line/) as HTMLInputElement).value).toBe("because");
      expect((screen.getByRole("radio", { name: "Alpha" }) as HTMLInputElement).checked).toBe(true);
      expect(onStale).not.toHaveBeenCalled();
    });
  });

  it("renders no error text or invalid marks on a pristine form", async () => {
    renderWithIntl(<CohortApplicationForm cohortId="cohort-2" onSaved={vi.fn()} />);
    await formReady();
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
    expect(document.querySelectorAll("[aria-invalid]")).toHaveLength(0);
    expect(screen.queryByText(/This field is required|Please choose an option/)).toBeNull();
  });

  it("shows a field's problem only after it is left, and clears it when fixed", async () => {
    renderWithIntl(<CohortApplicationForm cohortId="cohort-2" onSaved={vi.fn()} />);
    await formReady();
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
    const group = screen.getByRole("radiogroup", { name: /Web3 experience/ });
    expect(group.getAttribute("aria-required")).toBe("true");
    fireEvent.blur(group);
    expect(screen.getByText("Please choose an option.")).toBeTruthy();
  });

  it("does not call the API for an empty form and marks every missing field", async () => {
    const apply = vi.spyOn(api, "applyToCohort");
    renderWithIntl(<CohortApplicationForm cohortId="cohort-2" onSaved={vi.fn()} />);
    await formReady();
    fireEvent.click(screen.getByRole("button", { name: "Send application" }));
    expect(apply).not.toHaveBeenCalled();
    expect(screen.getAllByRole("alert").length).toBeGreaterThanOrEqual(6);
    expect(screen.getByLabelText(/^Name/).getAttribute("aria-invalid")).toBe("true");
  });

  it("asks for the detail when 'Other' is chosen and only then", async () => {
    renderWithIntl(<CohortApplicationForm cohortId="cohort-2" onSaved={vi.fn()} />);
    await formReady();
    expect(screen.queryByLabelText(/Tell us more/)).toBeNull();
    check("Other");
    expect(screen.getByLabelText(/Tell us more/)).toBeTruthy();
    check("Other");
    expect(screen.queryByLabelText(/Tell us more/)).toBeNull();
  });

  it("sends normalized values once, even for several submit events in one tick", async () => {
    const apply = vi.spyOn(api, "applyToCohort");
    const onSaved = vi.fn();
    renderWithIntl(<CohortApplicationForm cohortId="cohort-2" onSaved={onSaved} />);
    await formReady();
    fillForm();
    const form = screen.getByRole("button", { name: "Send application" }).closest("form") as HTMLFormElement;
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith("cohort-2", {
      displayName: "Mina Park", telegram: "@mina_builds", twitter: "@mina_builds", intro: "I build tools for Injective builders.",
      answers: [{ questionId: "web3_experience", choices: ["Y1_3"] }, { questionId: "interest_areas", choices: ["DEVELOPER", "RESEARCHER"] }],
    });
  });

  it("shows the BE's reason, keeps the typed answers and reports a stale page", async () => {
    vi.spyOn(api, "applyToCohort").mockRejectedValue(new ApiHttpError(409, "COHORT_NOT_ACCEPTING"));
    const onStale = vi.fn();
    renderWithIntl(<CohortApplicationForm cohortId="cohort-2" onSaved={vi.fn()} onStale={onStale} />);
    await formReady();
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Send application" }));
    expect((await screen.findByText(/not accepting applications right now/)).getAttribute("role")).toBe("alert");
    expect(onStale).toHaveBeenCalled();
    expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe("  Mina Park ");
  });

  it("maps a class-validator 400 to the named field", async () => {
    vi.spyOn(api, "applyToCohort").mockRejectedValue(new ApiHttpError(400, "VALIDATION_FAILED", ["telegram must be a valid Telegram username (5-32 letters, digits or _)"]));
    renderWithIntl(<CohortApplicationForm cohortId="cohort-2" onSaved={vi.fn()} />);
    await formReady();
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Send application" }));
    await waitFor(() => expect(screen.getByLabelText(/^Telegram ID/).getAttribute("aria-invalid")).toBe("true"));
    expect(screen.getByText(/Check every field and try again/)).toBeTruthy();
  });

  it("edits an existing application with PATCH and prefills it", async () => {
    const created = await api.applyToCohort("cohort-2", {
      displayName: "Me", telegram: "@me_builds", twitter: "@me_x", intro: "hi",
      answers: [{ questionId: "web3_experience", choices: ["GT_3Y"] }, { questionId: "interest_areas", choices: ["DEVELOPER"] }],
    });
    const update = vi.spyOn(api, "updateCohortApplication");
    const onSaved = vi.fn();
    renderWithIntl(<CohortApplicationForm application={created} cohortId="cohort-2" onCancel={vi.fn()} onSaved={onSaved} />);
    await formReady();
    expect((screen.getByRole("radio", { name: "Over 3 years" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("checkbox", { name: "Developer" }) as HTMLInputElement).checked).toBe(true);
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
      () => { api.getCurrentCohort = async () => ({ id: "c", name: "x", description: null, opensAt: null, closesAt: null, acceptingApplications: false, questions: [] }); },
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
    api.getCurrentCohort = async () => ({ id: "c", name: "1st", description: null, opensAt: null, closesAt: null, acceptingApplications: false, questions: [] });
    renderWithIntl(<RecruitView aboutSlot={about} />);
    expect(await screen.findByText("Applications are closed.")).toBeTruthy();
    expect(screen.queryByText("Sign in to apply")).toBeNull();
    expect(screen.getByRole("link", { name: "See the notices" }).getAttribute("href")).toBe("/notices");
    expect(screen.getByRole("link", { name: "See past activities" }).getAttribute("href")).toBe("/notices?category=events");
  });

  it("says there is no cohort when none is open", async () => {
    api.getCurrentCohort = async () => null;
    renderWithIntl(<RecruitView aboutSlot={about} />);
    expect(await screen.findByText("We're not recruiting right now.")).toBeTruthy();
    expect(screen.getByText(/take a look at what we have done/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "See the notices" }).getAttribute("href")).toBe("/notices");
    expect(screen.getByRole("link", { name: "See past activities" }).getAttribute("href")).toBe("/notices?category=events");
  });

  it("shows both links to a signed-in user whose cohort is open but not accepting", async () => {
    state.mode = "api";
    state.auth = signedInWith({ id: previewUser.id, onboardingCompleted: true });
    api.getCurrentCohort = async () => ({ id: "c", name: "1st", description: null, opensAt: "2999-01-01T00:00:00.000Z", closesAt: null, acceptingApplications: false, questions: [] });
    renderWithIntl(<RecruitView aboutSlot={about} />);
    expect(await screen.findByText("Applications are not open yet.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "See the notices" }).getAttribute("href")).toBe("/notices");
    expect(screen.getByRole("link", { name: "See past activities" }).getAttribute("href")).toBe("/notices?category=events");
  });

  it("offers a retry when the cohort cannot be read", async () => {
    api.getCurrentCohort = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValue(null);
    renderWithIntl(<RecruitView aboutSlot={about} />);
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("We're not recruiting right now.")).toBeTruthy();
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
    await formReady();
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
      displayName: "Me", telegram: "@me_builds", twitter: "@me_x", intro: "hi",
      answers: [{ questionId: "web3_experience", choices: ["GT_3Y"] }, { questionId: "interest_areas", choices: ["DEVELOPER"] }],
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
    expect(await screen.findByText("We're not recruiting right now.")).toBeTruthy();
    expect(screen.queryByLabelText(/^Name/)).toBeNull();
  });
});

describe("CohortApplicationCard", () => {
  it("withdraws through a confirmation and tells the owner to re-read when the application is already gone", async () => {
    const created = await api.applyToCohort("cohort-2", {
      displayName: "Me", telegram: "@me_builds", twitter: "@me_x", intro: "hi",
      answers: [{ questionId: "web3_experience", choices: ["GT_3Y"] }, { questionId: "interest_areas", choices: ["DEVELOPER"] }],
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

describe("CohortApplicationCard answers", () => {
  const lt = (ko: string, en: string | null) => ({ ko, en, zh: null });
  const base = {
    id: "a1", cohortId: "c1", cohort: { id: "c1", name: "2nd", status: "OPEN" as const, acceptingApplications: true }, status: "SUBMITTED" as const,
    reviewedAt: null, editable: false, withdrawable: false, createdAt: "2026-10-26T00:00:00.000Z", updatedAt: "2026-10-26T00:00:00.000Z",
    displayName: "Mina", telegram: "@mina", twitter: "@mina", intro: "hello",
  };
  const answers = [
    { questionId: "q1", type: "SHORT_TEXT" as const, label: lt("한 줄", "One line"), text: "my answer", choices: null, other: null },
    { questionId: "q2", type: "MULTI_CHOICE" as const, label: lt("분야", null), text: null, other: "UX research",
      choices: [{ id: "DEVELOPER", label: lt("개발자", "Developer") }, { id: "OTHER", label: lt("기타", null) }] },
  ];

  it("lists every answer in the viewer's language, falls back to Korean where there is no translation, and puts the detail after the option", () => {
    renderWithIntl(<CohortApplicationCard application={{ ...base, answers }} />);
    expect(screen.getByText("One line")).toBeTruthy();
    expect(screen.getByText("my answer")).toBeTruthy();
    expect(screen.getByText("분야")).toBeTruthy();
    expect(screen.getByText("Developer, 기타 (UX research)")).toBeTruthy();
  });

  it("keeps the compact variant to the status line", () => {
    renderWithIntl(<CohortApplicationCard application={{ ...base, answers }} variant="compact" />);
    expect(screen.queryByText("my answer")).toBeNull();
  });
});
