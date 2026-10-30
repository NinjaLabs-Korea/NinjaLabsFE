// @vitest-environment jsdom
import { act } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomeRecruitment } from "@/components/home/HomeRecruitment";
import { renderWithIntl } from "@/test/intl";
import { signedInWith } from "@/test/support/auth";

const user = signedInWith({ onboardingCompleted: true, profileSlug: "p" });
let api: { getCurrentCohort: () => Promise<unknown>; getMyCohortApplications: () => Promise<unknown> };
vi.mock("@/i18n/navigation", () => ({ Link: ({ children, href, ...props }: ComponentProps<"a">) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({ useAuthSnapshot: () => user, useCohortApi: () => api }));

beforeEach(() => {
  window.sessionStorage.clear();
  api = { getCurrentCohort: () => new Promise(() => undefined), getMyCohortApplications: () => new Promise(() => undefined) };
});
afterEach(() => window.sessionStorage.clear());

describe("HomeRecruitment while loading", () => {
  it("reserves the invite card when the per-tab hint says a cohort accepts", async () => {
    window.sessionStorage.setItem("ninja.cohortAccepting", "1");
    const view = renderWithIntl(<HomeRecruitment />);
    await act(async () => undefined);
    const section = view.container.querySelector("section");
    expect(section?.getAttribute("aria-hidden")).toBe("true");
    expect(section?.querySelector(".invisible")).toBeTruthy();
    expect(section?.querySelector("a")).toBeNull();
  });

  it("renders nothing without a hint (no cohort case keeps zero shift)", async () => {
    const view = renderWithIntl(<HomeRecruitment />);
    await act(async () => undefined);
    expect(view.container.textContent).toBe("");
  });
});
