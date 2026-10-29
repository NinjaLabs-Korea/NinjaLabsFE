// @vitest-environment jsdom
import { act, screen } from "@testing-library/react";
import { createFormatter } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalDateTime } from "@/components/bounties/LocalDateTime";
import { Markdown } from "@/components/ui/Markdown";
import { formatLocalDateTime } from "@/lib/format";
import { markdownToPlainSummary } from "@/lib/markdown-summary";
import { renderWithIntl } from "@/test/intl";

afterEach(() => vi.restoreAllMocks());

describe("formatLocalDateTime", () => {
  const format = createFormatter({ locale: "en", timeZone: "UTC" });
  it("uses the given zone and labels it", () => {
    expect(formatLocalDateTime(format, "2026-11-08T21:36:00Z", "Asia/Seoul")).toBe("Nov 9, 2026, 6:36 AM GMT+9");
  });
  it("returns an empty string for an unparsable value", () => {
    expect(formatLocalDateTime(format, "nope", "Asia/Seoul")).toBe("");
  });
});

describe("LocalDateTime", () => {
  it("shows the UTC text without an instant", () => {
    renderWithIntl(<LocalDateTime utcText="Nov 8, 2026, 9:36 PM UTC" />);
    expect(screen.getByText("Nov 8, 2026, 9:36 PM UTC")).toBeTruthy();
  });

  it("swaps to the viewer's local time after mount and keeps UTC in title and hidden text", async () => {
    const real = Intl.DateTimeFormat;
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(function (this: unknown, ...args: ConstructorParameters<typeof Intl.DateTimeFormat>) {
      return new real(args[0], { ...args[1], timeZone: args[1]?.timeZone ?? "Asia/Seoul" });
    } as never);
    renderWithIntl(<LocalDateTime iso="2026-11-08T21:36:00Z" utcText="Nov 8, 2026, 9:36 PM UTC" />);
    await act(async () => undefined);
    expect(screen.getByText(/Nov 9, 2026, 6:36 AM GMT\+9/)).toBeTruthy();
    expect(screen.getByTitle("Nov 8, 2026, 9:36 PM UTC")).toBeTruthy();
    expect(screen.getByText(/\(Nov 8, 2026, 9:36 PM UTC\)/).className).toContain("sr-only");
  });
});

describe("markdownToPlainSummary", () => {
  it("drops tables, images and link urls, and strips every heading level", () => {
    const body = "# Big heading\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n![alt](http://x/y.png)\n\n## Sub heading\n\n#### h4 text\n\n- item\n\nand [ok](https://e.com/a_(b)) [bad](javascript:alert(1)) done";
    const out = markdownToPlainSummary(body);
    expect(out).toBe("Big heading Sub heading h4 text item and ok bad done");
    for (const leak of ["|", "---", "alt", "x)", "http", "javascript", "]("]) expect(out).not.toContain(leak);
  });
});

describe("Markdown headings", () => {
  it("renders # as a styled heading and #### as h4", () => {
    renderWithIntl(<Markdown>{"# A\n\n#### B\n\n## C"}</Markdown>);
    expect(screen.getByRole("heading", { name: "A" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 4, name: "B" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "C" })).toBeTruthy();
  });
});
