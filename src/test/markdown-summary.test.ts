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

describe("markdownToPlainSummary on adversarial input", () => {
  const ADVERSARIAL: Array<[string, string]> = [
    ["blank lines with spaces", " \n".repeat(20_000)],
    ["unclosed links", "[a](".repeat(20_000)],
    ["unclosed images", "![a](".repeat(20_000)],
    ["unclosed tags", "<a ".repeat(20_000)],
    ["unclosed strong", "**a ".repeat(20_000)],
    ["unclosed emphasis", " _a".repeat(20_000)],
    ["horizontal-rule lookalikes", "- - - x\n".repeat(10_000)],
    ["long single line", "a".repeat(200_000)],
  ];

  it.each(ADVERSARIAL)("stays under 50 ms for %s", (_name, input) => {
    markdownToPlainSummary(input); // warm up the regex engine
    const started = performance.now();
    markdownToPlainSummary(input);
    expect(performance.now() - started).toBeLessThan(50);
  });

  it("only reads the head of a long body and never leaves half a surrogate pair", () => {
    expect(markdownToPlainSummary(`${"a".repeat(3999)}😀`, 5000)).toBe("a".repeat(3999));
    expect(markdownToPlainSummary(`${" ".repeat(4000)}tail`)).toBe("");
  });

  it("still strips links, tags and emphasis that span a reasonable length", () => {
    expect(markdownToPlainSummary("see [the docs](https://example.com/a) and <b>bold</b> **strong** _em_ ---")).toBe(
      "see the docs and bold strong em ---",
    );
    expect(markdownToPlainSummary("intro\n\n***\n\nnext")).toBe("intro next");
  });
});
