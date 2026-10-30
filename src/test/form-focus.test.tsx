// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CohortApplicationForm } from "@/components/recruit/CohortApplicationForm";
import { ProfileForm } from "@/components/signup/ProfileForm";
import { createMockApiClient } from "@/lib/mocks/api-client";
import { previewUser } from "@/lib/mocks/fixtures";
import { renderWithIntl } from "@/test/intl";
import { signedInAs } from "@/test/support/auth";

const api = createMockApiClient();
vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({
    useAuthSnapshot: () => signedInAs(previewUser),
    useAuthActions: () => ({ signIn: vi.fn(), signOut: vi.fn() }),
    useFoundationMode: () => "api",
    useCohortApi: () => api,
    useOnboardingApi: () => ({ checkNickname: vi.fn().mockResolvedValue({ available: true }), completeProfile: vi.fn(), completeOnboarding: vi.fn() }),
  }));

const scrollIntoView = vi.fn();
const setReducedMotion = (reduced: boolean) =>
  Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: reduced }) });

beforeEach(() => {
  sessionStorage.clear();
  scrollIntoView.mockReset();
  Element.prototype.scrollIntoView = scrollIntoView;
  setReducedMotion(false);
});
afterEach(() => Reflect.deleteProperty(window, "matchMedia"));

describe("focus the first invalid field on a failed submit", () => {
  it("CohortApplicationForm: focuses the first control, scrolls smoothly, shows the count", async () => {
    renderWithIntl(<CohortApplicationForm cohortId="c1" onSaved={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Send application" }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Name (real name or nickname)")));
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "smooth" });
    // name, telegram, twitter, web3Experience, activityType, interestAreas, intro
    expect(screen.getByText("7 fields need your attention.")).toBeTruthy();
  });

  it("CohortApplicationForm: reduced motion scrolls instantly; a choice group takes focus when it is first", async () => {
    setReducedMotion(true);
    renderWithIntl(<CohortApplicationForm cohortId="c1" onSaved={() => undefined} />);
    fireEvent.change(screen.getByLabelText("Name (real name or nickname)"), { target: { value: "Mina" } });
    fireEvent.change(screen.getByLabelText("Telegram ID"), { target: { value: "mina_p" } });
    fireEvent.change(screen.getByLabelText("X (Twitter) handle"), { target: { value: "mina_p" } });
    fireEvent.click(screen.getByRole("button", { name: "Send application" }));
    await waitFor(() => expect(document.activeElement?.tagName).toBe("FIELDSET"));
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "auto" });
  });

  it("ProfileForm: focuses the nickname and counts three problems", async () => {
    renderWithIntl(<ProfileForm />);
    fireEvent.click(screen.getByRole("button", { name: /continue|save|next|submit/i }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Nickname")));
    expect(screen.getByText("3 fields need your attention.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Bio"), { target: { value: "Builder" } });
    expect(screen.getByText("2 fields need your attention.")).toBeTruthy();
  });
});
