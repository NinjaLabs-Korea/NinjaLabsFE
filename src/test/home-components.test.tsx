// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";
import { HomeActivity } from "@/components/home/HomeActivity";
import { HomeProfileCard } from "@/components/home/HomeProfileCard";
import { HomeQuickLinks } from "@/components/home/HomeQuickLinks";
import { HomeRecruitment } from "@/components/home/HomeRecruitment";
import { ReturnPathNotice } from "@/components/signup/ReturnPathNotice";
import type { ApiClient } from "@/lib/contracts/api";
import type { AuthSnapshot } from "@/lib/contracts/auth";
import { createMockApiClient } from "@/lib/mocks/api-client";
import { previewUser } from "@/lib/mocks/fixtures";
import { peekReturnPath, rememberReturnPath } from "@/lib/return-path";
import { renderWithIntl } from "@/test/intl";
import { signedInAs, signedInWith } from "@/test/support/auth";

const state: { auth: AuthSnapshot } = { auth: signedInAs(previewUser) };
let api: ApiClient;
const signIn = vi.fn(async () => state.auth);
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: ComponentProps<"a">) => <a href={href} {...props}>{children}</a>,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({
    useAuthSnapshot: () => state.auth,
    useAuthActions: () => ({ signIn, signOut: vi.fn() }),
    useFoundationMode: () => "api",
    useAccountApi: () => api,
    useCohortApi: () => api,
  }));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); };
});
beforeEach(() => {
  api = createMockApiClient();
  state.auth = signedInAs(previewUser);
  signIn.mockClear();
});
afterEach(() => {
  window.sessionStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("HomeProfileCard", () => {
  it("greets by nickname with wallet and NFT status and links to the public profile and the settings", () => {
    state.auth = signedInWith({ handle: "ninja", profileSlug: "ninja", initials: "NI", walletAddress: "inj1abcdefghij9k4d", nftStatus: "MINTED", onboardingCompleted: true });
    renderWithIntl(<HomeProfileCard />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Welcome back, ninja");
    expect(screen.getByText("Wallet inj1ab…9k4d")).toBeTruthy();
    expect(screen.getByText("Ninja NFT issued")).toBeTruthy();
    expect(screen.getByRole("link", { name: "View my profile" }).getAttribute("href")).toBe("/members/ninja");
    expect(screen.getByRole("link", { name: "Profile and wallet settings" }).getAttribute("href")).toBe("/account");
  });

  it("sends someone without a wallet to the wallet card, and never claims a mint that did not happen", () => {
    state.auth = signedInWith({ handle: "ninja", walletAddress: undefined, nftStatus: "MINTING", onboardingCompleted: true });
    const view = renderWithIntl(<HomeProfileCard />);
    expect(screen.getByRole("link", { name: "Wallet not connected" }).getAttribute("href")).toBe("/account#wallet");
    expect(screen.getByText("Ninja NFT minting")).toBeTruthy();
    view.unmount();
    state.auth = signedInWith({ handle: "ninja", nftStatus: null, onboardingCompleted: true });
    renderWithIntl(<HomeProfileCard />);
    expect(screen.getByText("No Ninja NFT yet")).toBeTruthy();
  });
});

describe("HomeActivity", () => {
  it("lists my latest applications with their status, newest first and capped, linking to the full list", async () => {
    renderWithIntl(<HomeActivity />);
    await screen.findByText("Smart contract audit for reward vault");
    const links = screen.getAllByRole("link").filter((link) => link.getAttribute("href") !== "/applications");
    expect(links.length).toBeLessThanOrEqual(4);
    expect(screen.getAllByText("Applied").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Approved").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "See all →" }).getAttribute("href")).toBe("/applications");
  });

  it("labels an award-forfeited row like the My applications page does", async () => {
    api.getApplications = async () => ({ status: "available", data: [{
      id: "f1", source: "submission", bountySlug: "b1", bountyTitle: "Forfeited lookalike", category: "Dev", appliedAt: "2026-10-26T00:00:00.000Z",
      note: "", status: "notAccepted", agent: null, reviewComment: "forfeited: wallet never linked", reviewNote: null, paymentStatus: "NONE",
    }] });
    renderWithIntl(<HomeActivity />);
    expect(await screen.findByText("Award forfeited")).toBeTruthy();
    expect(screen.queryByText("Submission not accepted")).toBeNull();
  });

  it("has an empty state that points at the bounties", async () => {
    api.getApplications = async () => ({ status: "available", data: [] });
    renderWithIntl(<HomeActivity />);
    expect(await screen.findByText("You have not applied to a bounty yet.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Browse bounties" }).getAttribute("href")).toBe("/bounties");
  });

  it("offers a retry when the activity cannot be read", async () => {
    api.getApplications = vi.fn().mockResolvedValueOnce({ status: "unavailable", reason: "server-error" }).mockResolvedValue({ status: "available", data: [] });
    renderWithIntl(<HomeActivity />);
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("You have not applied to a bounty yet.")).toBeTruthy();
  });
});

describe("HomeRecruitment", () => {
  it("reads the invitation copy from recruit.banner, not a second copy under home", async () => {
    const ko = JSON.parse(readFileSync("messages/ko/home.json", "utf8")) as { recruit: Record<string, string> };
    expect(Object.keys(ko.recruit)).toEqual(["details"]);
  });

  const values = { displayName: "Me", telegram: "@me_builds", twitter: "@me_x", web3Experience: "GT_3Y" as const, activityType: "DEVELOPER" as const, activityTypeOther: null, interestAreas: ["DEVELOPER" as const], interestOther: null, intro: "hi" };

  it("invites a member who has not applied while a cohort accepts applications", async () => {
    renderWithIntl(<HomeRecruitment />);
    expect(await screen.findByText("Ninja Labs 2nd cohort is recruiting members")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Apply now" }).getAttribute("href")).toBe("/recruit");
  });

  it("shows my application's status instead of the invitation once I applied", async () => {
    await api.applyToCohort("cohort-2", values);
    renderWithIntl(<HomeRecruitment />);
    const card = (await screen.findByText("Under review")).closest("article") as HTMLElement;
    expect(within(card).getByText("Ninja Labs 2nd cohort")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Apply now" })).toBeNull();
    expect(screen.getByRole("link", { name: "Open the application page →" }).getAttribute("href")).toBe("/recruit");
  });

  it("keeps showing the result after the cohort closed, and says nothing when there is nothing to say", async () => {
    const created = await api.applyToCohort("cohort-2", values);
    await api.reviewAdminCohortApplication(created.id, { decision: "REJECTED", note: "internal" });
    await api.transitionAdminCohort("cohort-2", "CLOSED");
    const view = renderWithIntl(<HomeRecruitment />);
    expect(await screen.findByText("Not selected")).toBeTruthy();
    expect(view.container.textContent).not.toContain("internal");
    view.unmount();

    api = createMockApiClient();
    await api.transitionAdminCohort("cohort-2", "CLOSED");
    const quiet = renderWithIntl(<HomeRecruitment />);
    await waitFor(() => expect(api.getCurrentCohort).toBeTruthy());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(quiet.container.textContent).toBe("");
  });
});

describe("HomeQuickLinks", () => {
  it("links to the places a member goes most, including the community overview", () => {
    renderWithIntl(<HomeQuickLinks />);
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/bounties", "/applications", "/agents", "/hall-of-fame", "/members", "/about"]);
  });
});

describe("returning to the page that asked for the sign-in", () => {
  it("the sign-in button remembers ?returnTo= (a safe path only) before leaving for Google", async () => {
    window.history.replaceState(null, "", "/en/signup?returnTo=%2Frecruit");
    renderWithIntl(<GoogleLoginButton />);
    fireEvent.click(screen.getByRole("button", { name: /Continue with Google/ }));
    await waitFor(() => expect(signIn).toHaveBeenCalled());
    expect(peekReturnPath()).toBe("/recruit");
  });

  it("ignores an off-site or signup return target", async () => {
    window.history.replaceState(null, "", "/en/signup?returnTo=https%3A%2F%2Fevil.test");
    renderWithIntl(<GoogleLoginButton />);
    fireEvent.click(screen.getByRole("button", { name: /Continue with Google/ }));
    await waitFor(() => expect(signIn).toHaveBeenCalled());
    expect(peekReturnPath()).toBeNull();
  });

  it("the last signup step offers the remembered page and nothing otherwise", () => {
    const empty = renderWithIntl(<ReturnPathNotice />);
    expect(empty.container.textContent).toBe("");
    empty.unmount();
    rememberReturnPath("/recruit");
    renderWithIntl(<ReturnPathNotice />);
    const link = screen.getByRole("link", { name: "Continue" });
    expect(link.getAttribute("href")).toBe("/recruit");
    fireEvent.click(link);
    expect(peekReturnPath()).toBeNull();
  });
});
