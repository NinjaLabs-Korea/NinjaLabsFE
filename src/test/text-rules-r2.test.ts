import { describe, expect, it } from "vitest";
import { isValidNickname, validateNickname } from "@/lib/nickname";
import { hasStorableBodyText, hasVisibleText, isPlainDisplayText } from "@/lib/visible-text";

describe("hasVisibleText / isPlainDisplayText parity with the BE", () => {
  const visible: [string, boolean][] = [
    ["Bot", true],
    ["닌자", true],
    ["a\u0301", true],
    ["\u0301\u0301", false],
    ["\uFE0F", false],
    ["\u034F", false],
    ["\u17B4", false],
    ["\u180B", false],
    ["\u00AD", false],
    ["\u2800", false],
    ["￼", false],
    ["\uE000", false],
    ["\u200B\u2060 ㅤ", false],
  ];
  it.each(visible)("hasVisibleText(%j) = %s", (value, expected) => {
    expect(hasVisibleText(value)).toBe(expected);
  });

  const plain: [string, boolean][] = [
    ["Evil name", true],
    ["Evil\u202Ename", false],
    ["a\tb", false],
    ["a\nb", false],
    ["a\u2028b", false],
    ["a\u200Bb", false],
    ["a\u200Eb", false],
    ["a\u2060b", false],
    ["a\u2066b", false],
    ["a\uFEFFb", false],
    ["a\u200Db", true],
    ["a\u200Cb", true],
  ];
  it.each(plain)("isPlainDisplayText(%j) = %s", (value, expected) => {
    expect(isPlainDisplayText(value)).toBe(expected);
  });

  it("hasStorableBodyText allows line breaks and tabs, rejects NUL", () => {
    expect(hasStorableBodyText("a\nb\tc")).toBe(true);
    expect(hasStorableBodyText("a\u0000b")).toBe(false);
  });
});

describe("nickname homoglyph ranges", () => {
  it.each(["ɑdmin", "coreոinja", "ɡithub", "ninjaı", "ninjaȷ", "ꜱninja", "ᴀdmin", "ℓinja"])("rejects %s", (nick) => {
    expect(isValidNickname(nick)).toBe(false);
  });
  it.each(["coreninja", "닌자", "ninja닌자", "café", "ninja忍者", "ninjaニンジャ", "ninjaにんじゃ"])("accepts %s", (nick) => {
    expect(validateNickname(nick)).toBeNull();
  });
});
