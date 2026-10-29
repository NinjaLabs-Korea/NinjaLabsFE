// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CohortApplicationForm } from "@/components/recruit/CohortApplicationForm";
import { ApiHttpError } from "@/lib/api/http";
import { readCohortDraft } from "@/lib/cohort-application-draft";
import type { ApiClient } from "@/lib/contracts/api";
import type { AuthSnapshot } from "@/lib/contracts/auth";
import { createMockApiClient } from "@/lib/mocks/api-client";
import { renderWithIntl } from "@/test/intl";
import { signedInWith } from "@/test/support/auth";

const state: { auth: AuthSnapshot } = { auth: signedInWith({ id: "user-a" }) };
let api: ApiClient;
vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({
    useAuthSnapshot: () => state.auth,
    useCohortApi: () => api,
  }));

const KEY_A1 = "ninja.cohortDraft:user-a:cohort-1";
const KEY_A2 = "ninja.cohortDraft:user-a:cohort-2";
const type = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const value = (label: RegExp) => (screen.getByLabelText(label) as HTMLInputElement).value;
const fillAll = () => {
  type(/^Name/, "Mina Park");
  type(/^Telegram ID/, "mina_builds");
  type(/^X \(Twitter\) handle/, "mina_builds");
  fireEvent.click(screen.getByRole("radio", { name: "1-3 years" }));
  fireEvent.click(screen.getByRole("radio", { name: "Developer" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Researcher" }));
  type(/^Introduction and motivation/, "I build tools for Injective builders. ".repeat(4));
};
const submit = () => fireEvent.click(screen.getByRole("button", { name: "Send application" }));

beforeEach(() => {
  api = createMockApiClient();
  state.auth = signedInWith({ id: "user-a" });
});
afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("cohort application draft", () => {
  it("restores typed answers after unmount and remount", async () => {
    const first = renderWithIntl(<CohortApplicationForm cohortId="cohort-1" onSaved={vi.fn()} />);
    fillAll();
    first.unmount();
    renderWithIntl(<CohortApplicationForm cohortId="cohort-1" onSaved={vi.fn()} />);
    await waitFor(() => expect(value(/^Name/)).toBe("Mina Park"));
    expect(value(/^Telegram ID/)).toBe("mina_builds");
    expect((screen.getByRole("radio", { name: "1-3 years" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("checkbox", { name: "Researcher" }) as HTMLInputElement).checked).toBe(true);
  });

  it("clears the draft after a successful submit", async () => {
    const onSaved = vi.fn();
    renderWithIntl(<CohortApplicationForm cohortId="cohort-2" onSaved={onSaved} />);
    fillAll();
    expect(window.sessionStorage.getItem(KEY_A2)).not.toBeNull();
    submit();
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(window.sessionStorage.getItem(KEY_A2)).toBeNull();
  });

  it("keeps the draft after a failed submit and shows the new session copy", async () => {
    vi.spyOn(api, "applyToCohort").mockRejectedValueOnce(new ApiHttpError(401, "UNAUTHORIZED"));
    renderWithIntl(<CohortApplicationForm cohortId="cohort-1" onSaved={vi.fn()} />);
    fillAll();
    submit();
    expect(await screen.findByText(/What you wrote is still here/)).toBeTruthy();
    expect(value(/^Name/)).toBe("Mina Park");
    expect(readCohortDraft("user-a", "cohort-1")?.displayName).toBe("Mina Park");

    vi.spyOn(api, "applyToCohort").mockRejectedValueOnce(new Error("offline"));
    submit();
    await waitFor(() => expect(screen.queryByText(/What you wrote is still here/)).toBeNull());
    expect(readCohortDraft("user-a", "cohort-1")?.displayName).toBe("Mina Park");
  });

  it("does not show a draft to another user or on another cohort", async () => {
    const first = renderWithIntl(<CohortApplicationForm cohortId="cohort-1" onSaved={vi.fn()} />);
    fillAll();
    first.unmount();

    state.auth = signedInWith({ id: "user-b" });
    const other = renderWithIntl(<CohortApplicationForm cohortId="cohort-1" onSaved={vi.fn()} />);
    expect(value(/^Name/)).toBe("");
    other.unmount();

    state.auth = signedInWith({ id: "user-a" });
    renderWithIntl(<CohortApplicationForm cohortId="cohort-2" onSaved={vi.fn()} />);
    expect(value(/^Name/)).toBe("");
  });

  it("ignores corrupt JSON, wrong shapes and unknown choices", async () => {
    window.sessionStorage.setItem(KEY_A1, "{not json");
    expect(readCohortDraft("user-a", "cohort-1")).toBeNull();
    window.sessionStorage.setItem(KEY_A1, JSON.stringify(["x"]));
    expect(readCohortDraft("user-a", "cohort-1")).toBeNull();
    window.sessionStorage.setItem(KEY_A1, JSON.stringify({ displayName: 1 }));
    expect(readCohortDraft("user-a", "cohort-1")).toBeNull();
    window.sessionStorage.setItem(
      KEY_A1,
      JSON.stringify({ displayName: "Mina", telegram: "", twitter: "", intro: "", web3Experience: "BOGUS", interestAreas: ["KOL", "BOGUS"], extra: 1 }),
    );
    expect(readCohortDraft("user-a", "cohort-1")).toMatchObject({ displayName: "Mina", web3Experience: "", interestAreas: ["KOL"] });
    renderWithIntl(<CohortApplicationForm cohortId="cohort-1" onSaved={vi.fn()} />);
    await waitFor(() => expect(value(/^Name/)).toBe("Mina"));
  });

  it("does not crash when sessionStorage throws", () => {
    const boom = () => { throw new Error("blocked"); };
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(boom);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(boom);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(boom);
    renderWithIntl(<CohortApplicationForm cohortId="cohort-1" onSaved={vi.fn()} />);
    fillAll();
    expect(value(/^Name/)).toBe("Mina Park");
  });
});
