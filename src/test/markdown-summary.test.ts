import { describe, expect, it } from "vitest";
import { markdownToPlainSummary, NOTICE_SUMMARY_MAX } from "@/lib/markdown-summary";

describe("markdownToPlainSummary", () => {
  it("strips headings, emphasis, links, images, lists, quotes and code", () => {
    expect(markdownToPlainSummary("# Title\n> quoted _note_\n\n1. one\n* two\n![alt](/media/x.png) ~~old~~ __new__\n```js\nconst a = 1;\n```\nend")).toBe(
      "Title quoted note one two alt old new end",
    );
  });

  it("keeps snake_case words and lone asterisks intact", () => {
    expect(markdownToPlainSummary("use snake_case_name and 2 * 3")).toBe("use snake_case_name and 2 * 3");
  });

  it("truncates by code point with an ellipsis within the BE budget", () => {
    const long = "가".repeat(300);
    const summary = markdownToPlainSummary(long);
    expect(Array.from(summary)).toHaveLength(NOTICE_SUMMARY_MAX);
    expect(summary.endsWith("…")).toBe(true);
    expect(markdownToPlainSummary("😀".repeat(5), 3)).toBe("😀😀…");
    expect(markdownToPlainSummary("short")).toBe("short");
  });
});
