import { describe, expect, it } from "vitest";
import { parseReviewComment } from "@/lib/review-comment";

describe("parseReviewComment", () => {
  it("returns null for empty input", () => {
    for (const value of [null, undefined, "", "  "]) expect(parseReviewComment(value)).toBeNull();
  });
  it("keeps a plain comment as is", () => {
    expect(parseReviewComment(" needs work ")).toEqual({ forfeited: false, text: "needs work" });
  });
  it("detects the forfeited: prefix and strips it", () => {
    expect(parseReviewComment("forfeited: winner wallet never connected")).toEqual({ forfeited: true, text: "winner wallet never connected" });
    expect(parseReviewComment("forfeited:no space")).toEqual({ forfeited: true, text: "no space" });
  });
  it("does not treat a mid-sentence mention as a forfeit", () => {
    expect(parseReviewComment("not forfeited: ok")).toEqual({ forfeited: false, text: "not forfeited: ok" });
  });
});
