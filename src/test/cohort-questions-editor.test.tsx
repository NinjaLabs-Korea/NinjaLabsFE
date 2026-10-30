// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminToastHost } from "@/components/admin/AdminToastHost";
import { RecruitmentManager } from "@/components/admin/RecruitmentManager";
import { draftsToInputs } from "@/components/admin/CohortQuestionsEditor";
import { ApiHttpError } from "@/lib/api/http";
import type { ApiClient } from "@/lib/contracts/api";
import { createMockApiClient } from "@/lib/mocks/api-client";
import { renderWithIntl } from "@/test/intl";

let api: ApiClient;
vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({ useAdminCohortApi: () => api }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: Omit<ComponentProps<"a">, "href"> & { href: string }) => <a href={href} {...props}>{children}</a>,
}));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); };
  HTMLElement.prototype.scrollIntoView = () => undefined;
});
beforeEach(() => {
  api = createMockApiClient();
});

const mount = () => renderWithIntl(<><RecruitmentManager tabs={null}><h1>Member recruitment</h1></RecruitmentManager><AdminToastHost /></>);
const row = (name: string) => screen.getByRole("row", { name: new RegExp(name) });
const openDialog = () => document.querySelector("dialog[open]") as HTMLElement;
const questionItem = (number: number) => screen.getByRole("heading", { name: `Question ${number}` }).closest("li") as HTMLElement;

async function openEditor(name = "Ninja Labs 2nd cohort") {
  mount();
  await screen.findByRole("cell", { name });
  fireEvent.click(within(row(name)).getByRole("button", { name: "Questions" }));
  await screen.findByRole("heading", { name: `${name} application questions` });
}
const save = () => fireEvent.click(screen.getByRole("button", { name: "Save questions" }));

describe("draftsToInputs", () => {
  it("keeps ids of existing questions and options, omits them for new ones and turns blank translations into null", () => {
    expect(draftsToInputs([
      { key: "a", id: "web3_experience", type: "SINGLE_CHOICE", ko: " 경력 ", en: " ", zh: "经验", helpKo: "", helpEn: "ignored", helpZh: "", required: true,
        options: [{ key: "o1", id: "LT_1Y", ko: "짧음", en: "", zh: "", withDetail: false }, { key: "new-1", ko: "새것", en: "New", zh: "", withDetail: true }] },
      { key: "new-2", type: "SHORT_TEXT", ko: "한 줄", en: "", zh: "", helpKo: "도움", helpEn: "", helpZh: "", required: false, options: null },
    ])).toEqual([
      { id: "web3_experience", type: "SINGLE_CHOICE", label: { ko: "경력", en: null, zh: "经验" }, help: null, required: true,
        options: [{ id: "LT_1Y", label: { ko: "짧음", en: null, zh: null }, withDetail: false }, { label: { ko: "새것", en: "New", zh: null }, withDetail: true }] },
      { type: "SHORT_TEXT", label: { ko: "한 줄", en: null, zh: null }, help: { ko: "도움", en: null, zh: null }, required: false, options: null },
    ]);
  });
});

describe("CohortQuestionsEditor", () => {
  it("shows the cohort's questions with the fixed-fields note and the 'answers do not change' note", async () => {
    await openEditor();
    expect(screen.getByText("Answers in applications already received do not change.")).toBeTruthy();
    expect(screen.getByText(/Name, Telegram, X and introduction are always collected/)).toBeTruthy();
    expect((within(questionItem(1)).getByLabelText("Question (Korean)") as HTMLInputElement).value).toBe("Web3 경력");
    expect((within(questionItem(2)).getByLabelText("Question (Korean)") as HTMLInputElement).value).toBe("참여하고 싶은 분야");
    expect((screen.getByRole("button", { name: "Save questions" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("builds the PUT body: add a required short question, rename one, remove one, keep ids", async () => {
    const put = vi.spyOn(api, "saveAdminCohortQuestions");
    await openEditor();
    // rename the interest question
    fireEvent.change(within(questionItem(2)).getByLabelText("Question (Korean)"), { target: { value: "관심 분야" } });
    // remove the first (web3_experience) after a confirmation
    fireEvent.click(screen.getByRole("button", { name: "Delete question 1" }));
    fireEvent.click(within(openDialog()).getByRole("button", { name: "Delete question" }));
    // add a short text question
    fireEvent.click(screen.getByRole("button", { name: "Add question" }));
    fireEvent.change(within(questionItem(2)).getByLabelText("Question (Korean)"), { target: { value: "GitHub 주소" } });
    fireEvent.click(within(questionItem(2)).getByRole("checkbox", { name: "Required question" }));
    expect(screen.getByText("You have unsaved changes.")).toBeTruthy();
    save();
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    const [cohortId, body] = put.mock.calls[0];
    expect(cohortId).toBe("cohort-2");
    expect(body).toHaveLength(2);
    expect(body[0]).toMatchObject({ id: "interest_areas", type: "MULTI_CHOICE", label: { ko: "관심 분야" }, required: true });
    expect(body[0].options).toHaveLength(7);
    expect(body[0].options?.every((option) => option.id !== undefined)).toBe(true);
    expect(body[1]).toEqual({ type: "SHORT_TEXT", label: { ko: "GitHub 주소", en: null, zh: null }, help: null, required: true, options: null });
    expect(await screen.findByText("Application questions saved")).toBeTruthy();
    expect((await api.getAdminCohorts()).find((cohort) => cohort.id === "cohort-2")?.questions.map((question) => question.label.ko)).toEqual(["관심 분야", "GitHub 주소"]);
    expect((screen.getByRole("button", { name: "Save questions" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("allows one 'ask for details' option per question and 2..20 options", async () => {
    await openEditor();
    const interests = within(questionItem(2));
    // The default question already has its detail option ("기타"): the other checkboxes are disabled.
    const boxes = interests.getAllByRole("checkbox", { name: "Ask for details" }) as HTMLInputElement[];
    expect(boxes.filter((box) => box.checked)).toHaveLength(1);
    expect(boxes.filter((box) => !box.checked).every((box) => box.disabled)).toBe(true);
    // The Web3 question has 3 options: remove one is fine, a pair is the floor.
    const web3 = within(questionItem(1));
    fireEvent.click(web3.getByRole("button", { name: "Delete option 3" }));
    expect((web3.getByRole("button", { name: "Delete option 1" }) as HTMLButtonElement).disabled).toBe(true);
    // Up to 20 options.
    for (let i = 0; i < 18; i += 1) fireEvent.click(web3.getByRole("button", { name: "Add option" }));
    expect((web3.getByRole("button", { name: "Add option" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("moves questions and options up and down", async () => {
    const put = vi.spyOn(api, "saveAdminCohortQuestions");
    await openEditor();
    fireEvent.click(screen.getByRole("button", { name: "Move question 2 up" }));
    expect((within(questionItem(1)).getByLabelText("Question (Korean)") as HTMLInputElement).value).toBe("참여하고 싶은 분야");
    fireEvent.click(within(questionItem(2)).getByRole("button", { name: "Move option 1 down" }));
    save();
    await waitFor(() => expect(put).toHaveBeenCalled());
    const body = put.mock.calls[0][1];
    expect(body.map((question) => question.id)).toEqual(["interest_areas", "web3_experience"]);
    expect(body[1].options?.map((option) => option.id)).toEqual(["Y1_3", "LT_1Y", "GT_3Y"]);
  });

  it("blocks a save with a missing label before calling the BE and marks the field", async () => {
    const put = vi.spyOn(api, "saveAdminCohortQuestions");
    await openEditor();
    fireEvent.click(screen.getByRole("button", { name: "Add question" }));
    save();
    expect(await screen.findAllByText("Write the question in Korean.")).not.toHaveLength(0);
    expect(within(questionItem(3)).getByLabelText(/^Question \(Korean\)/).getAttribute("aria-invalid")).toBe("true");
    expect(put).not.toHaveBeenCalled();
  });

  it("shows the BE's reason when the list is refused, and keeps the edits", async () => {
    vi.spyOn(api, "saveAdminCohortQuestions").mockRejectedValue(new ApiHttpError(400, "COHORT_QUESTIONS_INVALID"));
    await openEditor();
    fireEvent.change(within(questionItem(1)).getByLabelText("Question (Korean)"), { target: { value: "바뀜" } });
    save();
    expect(await screen.findByText("Could not save the questions. Check the number of options and the wording.")).toBeTruthy();
    expect((within(questionItem(1)).getByLabelText("Question (Korean)") as HTMLInputElement).value).toBe("바뀜");
  });

  it("asks before closing or switching away from unsaved edits", async () => {
    await openEditor();
    fireEvent.change(within(questionItem(1)).getByLabelText("Question (Korean)"), { target: { value: "바뀜" } });
    fireEvent.click(within(row("Ninja Labs 1st cohort")).getByRole("button", { name: "Questions" }));
    expect(within(openDialog()).getByText("Discard unsaved changes?")).toBeTruthy();
    fireEvent.click(within(openDialog()).getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("heading", { name: "Ninja Labs 2nd cohort application questions" })).toBeTruthy();
    fireEvent.click(within(row("Ninja Labs 1st cohort")).getByRole("button", { name: "Questions" }));
    fireEvent.click(within(openDialog()).getByRole("button", { name: "Discard" }));
    expect(await screen.findByRole("heading", { name: "Ninja Labs 1st cohort application questions" })).toBeTruthy();
    // Nothing unsaved now: closing does not ask.
    fireEvent.click(within(screen.getByRole("heading", { name: /application questions/ }).closest("section")!).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("heading", { name: /application questions/ })).toBeNull();
  });
});
