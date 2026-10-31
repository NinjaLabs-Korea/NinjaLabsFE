// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApplicationsView } from "@/components/account/ApplicationsView";
import { HomeActivity } from "@/components/home/HomeActivity";
import { applicationBadge, applicationBadgeVariant, isClosedForSubmit } from "@/lib/application-badge";
import { applicationDecisionsFor } from "@/lib/admin-operations";
import { isDeadlinePassed, toPublicStatus } from "@/lib/bounty-status";
import type { AccountApplication, ApplicationStatus } from "@/lib/contracts/account";
import type { ApiClient } from "@/lib/contracts/api";
import { createMockApiClient } from "@/lib/mocks/api-client";
import { previewUser } from "@/lib/mocks/fixtures";
import { renderWithIntl } from "@/test/intl";
import { signedInAs } from "@/test/support/auth";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: ComponentProps<"a">) => <a href={String(href)} {...props}>{children}</a>,
}));

let api: ApiClient;
vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({
    useAuthSnapshot: () => signedInAs(previewUser),
    useAccountApi: () => api,
    useBountyApi: () => api,
    useFoundationMode: () => "api",
  }));

const NOW = Date.parse("2026-10-31T00:00:00.000Z");
const FUTURE = "2026-12-01T00:00:00.000Z";
const PAST = "2026-10-01T00:00:00.000Z";
const t = (key: string, values?: Record<string, string>) => (values ? `${key}(${Object.values(values).join(",")})` : key);

const row = (status: ApplicationStatus, overrides: Partial<AccountApplication> = {}): AccountApplication => ({
  id: `app-${status}-${overrides.bountyStatus ?? "none"}`, bountySlug: `b-${status}`, bountyTitle: `Bounty ${status} ${overrides.bountyStatus ?? ""}`.trim(),
  category: "Dev", appliedAt: "2026-10-20T00:00:00.000Z", note: "", status, agent: null, reviewComment: null, reviewNote: null, paymentStatus: "NONE",
  ...overrides,
});

describe("isDeadlinePassed (the one BE deadline rule)", () => {
  it("passes at the deadline itself, not before; no deadline never passes", () => {
    expect(isDeadlinePassed("2026-10-31T00:00:00.000Z", NOW)).toBe(true);
    expect(isDeadlinePassed("2026-10-31T00:00:00.001Z", NOW)).toBe(false);
    expect(isDeadlinePassed(PAST, NOW)).toBe(true);
    expect(isDeadlinePassed(null, NOW)).toBe(false);
    expect(isDeadlinePassed(undefined, NOW)).toBe(false);
  });

  it("reads an unparseable value as passed unless the caller asks otherwise", () => {
    expect(isDeadlinePassed("not a date", NOW)).toBe(true);
    expect(isDeadlinePassed("", NOW)).toBe(true);
    expect(isDeadlinePassed("not a date", NOW, { invalidPassed: false })).toBe(false);
  });

  it("keeps each caller's previous answer", () => {
    // Public status: an unparseable deadline presents as closed.
    expect(toPublicStatus("OPEN", "garbage", NOW)).toBe("closed");
    expect(toPublicStatus("OPEN", FUTURE, NOW)).toBe("active");
    // Admin approval: a missing or unparseable deadline closes approval.
    const bounty = { id: "b", title: "B", status: "OPEN", submissionDeadline: FUTURE, maxWinners: 1, applicationRequired: true };
    expect(applicationDecisionsFor({ status: "PENDING" }, bounty, NOW)).toEqual(["APPROVED", "REJECTED"]);
    expect(applicationDecisionsFor({ status: "PENDING" }, { ...bounty, submissionDeadline: null }, NOW)).toEqual(["REJECTED"]);
    expect(applicationDecisionsFor({ status: "PENDING" }, { ...bounty, submissionDeadline: "garbage" }, NOW)).toEqual(["REJECTED"]);
    // My applications: an unparseable deadline does not invent a closure.
    expect(isClosedForSubmit({ bountyStatus: "OPEN", submissionDeadline: "garbage" }, NOW)).toBe(false);
    expect(isClosedForSubmit({ bountyStatus: "OPEN", submissionDeadline: PAST }, NOW)).toBe(true);
    expect(isClosedForSubmit({}, NOW)).toBe(false);
  });
});

describe("applicationBadge (one rule for /applications and the home list)", () => {
  it("is neutral for every row on a cancelled bounty (product decision 2026-10-31)", () => {
    for (const status of ["open", "approved", "rejected", "notAccepted", "completed"] as const) {
      expect(applicationBadgeVariant(row(status, { bountyStatus: "CANCELLED", submissionDeadline: FUTURE }), NOW), status).toBe("neutral");
    }
    expect(applicationBadgeVariant(row("notAccepted", { closedByCancellation: true }), NOW)).toBe("neutral");
  });

  it("keeps the status color otherwise, and gray for approved work that can no longer be submitted", () => {
    const open = { bountyStatus: "OPEN" as const, submissionDeadline: FUTURE };
    expect(applicationBadgeVariant(row("open", open), NOW)).toBe("neutral");
    expect(applicationBadgeVariant(row("approved", open), NOW)).toBe("success");
    expect(applicationBadgeVariant(row("approved", { ...open, submissionDeadline: PAST }), NOW)).toBe("neutral");
    expect(applicationBadgeVariant(row("submitted", open), NOW)).toBe("primary-soft");
    expect(applicationBadgeVariant(row("rejected", open), NOW)).toBe("danger");
    expect(applicationBadgeVariant(row("revisionRequested", open), NOW)).toBe("warning");
    expect(applicationBadgeVariant(row("rejected"), NOW)).toBe("danger");
  });

  it("uses the same words in both places; the compact card only shortens an approved, still-open row", () => {
    const open = { bountyStatus: "OPEN" as const, submissionDeadline: FUTURE };
    expect(applicationBadge(t, row("approved", open), NOW).label).toBe("approvedStatus");
    expect(applicationBadge(t, row("approved", open), NOW, { compact: true }).label).toBe("steps.approved");
    for (const application of [
      row("approved", { bountyStatus: "CANCELLED" }),
      row("open", { bountyStatus: "OPEN", submissionDeadline: PAST }),
      row("notAccepted", { closedByCancellation: true }),
      row("rejected", { bountyStatus: "CANCELLED" }),
      row("revisionRequested", open),
    ]) {
      expect(applicationBadge(t, application, NOW, { compact: true })).toEqual(applicationBadge(t, application, NOW));
    }
  });
});

describe("the two pages agree on a cancelled bounty", () => {
  const rows = [row("rejected", { bountyStatus: "CANCELLED" }), row("approved", { bountyStatus: "CANCELLED" })];
  beforeEach(() => {
    api = createMockApiClient();
    api.getApplications = async () => ({ status: "available", data: rows });
  });
  const badgeClass = (text: string) => (screen.getByText(text).closest("span[class*='rounded-full']") as HTMLElement).className;

  it.each([["home", <HomeActivity key="home" />], ["/applications", <ApplicationsView key="list" />]])("%s draws them gray with the closed wording", async (_, view) => {
    renderWithIntl(view);
    await screen.findByText("Not selected");
    expect(badgeClass("Not selected")).toContain("bg-surface-subtle");
    expect(badgeClass("Approved: submissions closed")).toContain("bg-surface-subtle");
  });
});
