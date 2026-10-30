// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
    useFoundationMode: () => "mock",
    useCohortApi: () => api,
    useOnboardingApi: () => ({ checkNickname: vi.fn().mockResolvedValue({ available: true }), completeProfile: vi.fn(), completeOnboarding: vi.fn() }),
  }));

beforeEach(() => sessionStorage.clear());

/** Every label/legend text node, minus the aria-hidden star, must not end with `*`. */
function expectNoLiteralStar(container: HTMLElement) {
  const labels = container.querySelectorAll("label, legend");
  expect(labels.length).toBeGreaterThan(0);
  for (const label of labels) {
    const clone = label.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('[aria-hidden="true"]').forEach((mark) => mark.remove());
    expect(clone.textContent?.trim().endsWith("*"), clone.textContent ?? "").toBe(false);
  }
}

describe("required marks", () => {
  it("ProfileForm: star is an aria-hidden mark, hint is present, names resolve without a star", () => {
    const { container } = renderWithIntl(<ProfileForm />);
    expectNoLiteralStar(container);
    expect(container.querySelectorAll('span[aria-hidden="true"]').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText("Fields marked * are required.")).toBeTruthy();
    expect(screen.getByLabelText("Nickname")).toBeTruthy();
    expect(screen.getByLabelText("Bio")).toBeTruthy();
  });

  it("CohortApplicationForm: same", () => {
    const { container } = renderWithIntl(<CohortApplicationForm cohortId="c1" onSaved={() => undefined} />);
    expectNoLiteralStar(container);
    expect(container.querySelectorAll('span[aria-hidden="true"]').length).toBeGreaterThanOrEqual(5);
    expect(screen.getByText("Fields marked * are required.")).toBeTruthy();
    expect(screen.getByLabelText("Telegram ID")).toBeTruthy();
    expect(screen.getByLabelText("Introduction and motivation")).toBeTruthy();
  });
});
