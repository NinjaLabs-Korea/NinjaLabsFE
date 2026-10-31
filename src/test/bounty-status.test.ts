import { describe, expect, it } from "vitest";
import { FINISHED, IN_PROGRESS, fromAdminStatus, isBountyFinished, isBountyInProgress, toAdminStatus, toClosedReason, toPublicStatus, type BountyStatusCode } from "@/lib/bounty-status";

const NOW = Date.parse("2026-07-01T00:00:00Z");
const PAST = "2026-06-30T00:00:00Z";
const FUTURE = "2026-07-02T00:00:00Z";

type Expected = { status: "active" | "reviewing" | "closed"; reason: "completed" | "cancelled" | "deadline" | undefined };
const TABLE: Array<[BountyStatusCode, "past" | "future", Expected]> = [
  ["DRAFT", "past", { status: "closed", reason: "cancelled" }],
  ["DRAFT", "future", { status: "closed", reason: "cancelled" }],
  ["FUNDING_PENDING", "past", { status: "closed", reason: "cancelled" }],
  ["FUNDING_PENDING", "future", { status: "closed", reason: "cancelled" }],
  ["OPEN", "past", { status: "closed", reason: "deadline" }],
  ["OPEN", "future", { status: "active", reason: undefined }],
  ["SUBMISSION_CLOSED", "past", { status: "reviewing", reason: undefined }],
  ["SUBMISSION_CLOSED", "future", { status: "reviewing", reason: undefined }],
  ["IN_REVIEW", "past", { status: "reviewing", reason: undefined }],
  ["IN_REVIEW", "future", { status: "reviewing", reason: undefined }],
  ["COMPLETED", "past", { status: "closed", reason: "completed" }],
  ["COMPLETED", "future", { status: "closed", reason: "completed" }],
  ["CANCELLED", "past", { status: "closed", reason: "cancelled" }],
  ["CANCELLED", "future", { status: "closed", reason: "cancelled" }],
];

describe("bounty status folds", () => {
  it.each(TABLE)("%s with a %s deadline", (code, when, expected) => {
    const status = toPublicStatus(code, when === "past" ? PAST : FUTURE, NOW);
    expect(status).toBe(expected.status);
    expect(toClosedReason(code, status)).toBe(expected.reason);
  });

  it("reads an unparseable deadline on an OPEN bounty as passed", () => {
    expect(toPublicStatus("OPEN", "nope", NOW)).toBe("closed");
  });

  it("maps every BE status to its admin status and back", () => {
    expect((["DRAFT", "FUNDING_PENDING", "OPEN", "SUBMISSION_CLOSED", "IN_REVIEW", "COMPLETED", "CANCELLED"] as const).map(toAdminStatus)).toEqual([
      "draft", "funding", "active", "submissionClosed", "reviewing", "completed", "cancelled",
    ]);
    expect(toAdminStatus("SOMETHING_NEW")).toBe("completed");
    expect(fromAdminStatus("submissionClosed")).toBe("SUBMISSION_CLOSED");
  });

  it("keeps the in-progress and finished sets disjoint and as the BE defines them", () => {
    expect([...IN_PROGRESS]).toEqual(["OPEN", "SUBMISSION_CLOSED", "IN_REVIEW"]);
    expect([...FINISHED]).toEqual(["COMPLETED", "CANCELLED"]);
    expect(isBountyInProgress("IN_REVIEW")).toBe(true);
    expect(isBountyInProgress("DRAFT")).toBe(false);
    expect(isBountyFinished("CANCELLED")).toBe(true);
    expect(isBountyFinished("OPEN")).toBe(false);
  });
});
