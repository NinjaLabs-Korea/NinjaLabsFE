import { describe, expect, it } from "vitest";
import { hasVisibleText } from "@/lib/visible-text";
import { BE_VISIBLE_ACCEPTED, BE_VISIBLE_REJECTED } from "./be-validator-fixtures";

describe("hasVisibleText (mirror of BE visible-text.ts)", () => {
  it.each(BE_VISIBLE_ACCEPTED)("accepts %j like the BE", (value) => expect(hasVisibleText(value)).toBe(true));
  it.each(BE_VISIBLE_REJECTED)("rejects %j like the BE", (value) => expect(hasVisibleText(value)).toBe(false));

  it("rejects zero-width space, braille blank, object replacement and bidi controls", () => {
    for (const value of ["​", "⠀", "￼", "‮", "⁦⁩", "‎‏"]) expect(hasVisibleText(value)).toBe(false);
  });

  it("rejects a string made only of combining marks but accepts a base letter with one", () => {
    expect(hasVisibleText("́̂")).toBe(false);
    expect(hasVisibleText("é")).toBe(true);
  });

  it("accepts normal Korean and emoji", () => {
    expect(hasVisibleText("안녕하세요")).toBe(true);
    expect(hasVisibleText("🥷")).toBe(true);
    expect(hasVisibleText("👩‍💻")).toBe(true);
  });
});
