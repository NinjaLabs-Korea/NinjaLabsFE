import { describe, expect, it } from "vitest";
import { ApiHttpError } from "@/lib/api/http";
import { validationFieldsFromError, validationFieldsFromMessages } from "@/lib/api/validation";
import { isReservedNickname, isValidNickname, NICKNAME, nicknameInitials, nicknameLength, normalizeNickname, validateNickname } from "@/lib/nickname";
import { STATIC_FILE_EXTENSIONS } from "@/lib/static-extensions";

// Probe cases mirror NinjaLabsBE `src/users/users.dto.spec.ts` (CompleteProfileDto) - keep the two files in step.
describe("nickname rule (mirror of BE users/nickname.ts)", () => {
  it("accepts unicode letters/digits with _ . - and trims surrounding whitespace", () => {
    expect(validateNickname("ninja_dev")).toBeNull();
    expect(validateNickname("닌자.개발자-01")).toBeNull();
    expect(validateNickname("  ninja  ")).toBeNull();
  });

  it("normalizes to NFC like the BE: decomposed accents and Hangul jamo are accepted and sent composed", () => {
    const decomposed = "cafe\u0301";
    expect(normalizeNickname(`  ${decomposed} `)).toBe("caf\u00e9");
    expect(validateNickname(decomposed)).toBeNull();
    expect(validateNickname("\u1112\u1161\u11ab\u1112\u1161\u11ab")).toBeNull();
    expect(normalizeNickname("\u1112\u1161\u11ab\u1112\u1161\u11ab")).toBe("\ud55c\ud55c");
  });

  it.each([
    ["a", "tooShort"], ["n".repeat(51), "tooLong"], ["ninja dev", "chars"], ["ninja@dev", "chars"], ["ninja/dev", "chars"],
    ["ninja<b>", "chars"], ["   ", "tooShort"], ["​​", "chars"],
  ])("rejects %p as %s (length 2..50, no whitespace or symbols beyond _ . -)", (nickname, reason) => {
    expect(validateNickname(nickname)).toBe(reason);
  });

  it.each([".ninja", "ninja.", "-ninja", "ninja-", "_ninja", "ninja_", "..", "...", "--", "-.", ".-", "_-_", ".a", "a."])(
    "rejects %p: must start and end with a letter or digit",
    (nickname) => {
      expect(validateNickname(nickname)).toBe("edge");
    },
  );

  it.each(["a.b", "a-b", "a_b", "ninja-dev", "n.i.n.j.a", "닌자.개발자", "01", "me2", "admin1", "newbie", "edits"])(
    "accepts %p (letters/digits at both ends)",
    (nickname) => {
      expect(isValidNickname(nickname)).toBe(true);
      expect(NICKNAME.test(nickname)).toBe(true);
    },
  );

  it("counts length in code points like validator isLength (astral letters are one character)", () => {
    const astral = "𝐀"; // U+1D400 MATHEMATICAL BOLD CAPITAL A: \p{L}, two UTF-16 code units
    expect(astral.length).toBe(2);
    expect(nicknameLength(astral)).toBe(1);
    expect(validateNickname(astral)).toBe("tooShort");
    expect(validateNickname(astral.repeat(2))).toBeNull();
    expect(validateNickname(astral.repeat(50))).toBeNull();
    expect(validateNickname(astral.repeat(51))).toBe("tooLong");
    expect(validateNickname(`${astral.repeat(49)}😀`)).toBe("chars");
  });

  it.each(["me", "ME", "Me", "check-nickname", "Check-Nickname", "admin", "ADMIN", "new", "New", "edit", "EDIT", "  me  ", "withdrawn_1a2b3c4d", "Withdrawn_x"])(
    "rejects the reserved route word %p (case-insensitive)",
    (nickname) => {
      expect(isReservedNickname(nickname)).toBe(true);
      expect(validateNickname(nickname)).toBe("reserved");
    },
  );
  it.each(["ninja.js", "ninja.JSON", "ninja.Png", "a.woff2", "first.last.css", "닌자.svg", "x.map"])(
    "rejects %p: ends in a static-file extension the proxy skips (case-insensitive)",
    (nickname) => {
      expect(validateNickname(nickname)).toBe("staticExtension");
    },
  );

  it.each(["ninja.inj", "ninja.jsx", "ninja.json5", "ninjajs", "ninja-js", "ninja_json", "js.ninja", "ninja.js2"])(
    "accepts %p: not a dot followed by an exact static-file extension at the end",
    (nickname) => {
      expect(validateNickname(nickname)).toBeNull();
    },
  );

  it("checks the extension against every entry of lib/static-extensions.ts", () => {
    for (const extension of STATIC_FILE_EXTENSIONS) {
      expect(validateNickname(`ninja.${extension}`), extension).toBe("staticExtension");
      expect(validateNickname(`ninja.${extension.toUpperCase()}`), extension).toBe("staticExtension");
    }
  });
});

describe("BE VALIDATION_FAILED message[] → field hints", () => {
  it("maps class-validator messages to the property they name, first message per field", () => {
    expect(validationFieldsFromMessages([
      "nickname must match /^[\\p{L}\\p{N}][\\p{L}\\p{N}_.-]*[\\p{L}\\p{N}]$/u regular expression",
      "nickname is a reserved word",
      "bio should not be empty",
      "tags should not be empty",
      "reward.amount must match /^[0-9]+$/ regular expression",
      "property extra should not exist",
      "Something unrelated",
    ])).toEqual({
      nickname: "nickname must match /^[\\p{L}\\p{N}][\\p{L}\\p{N}_.-]*[\\p{L}\\p{N}]$/u regular expression",
      bio: "bio should not be empty",
      tags: "tags should not be empty",
      "reward.amount": "reward.amount must match /^[0-9]+$/ regular expression",
    });
  });

  it("reads details only from a VALIDATION_FAILED ApiHttpError", () => {
    expect(validationFieldsFromError(new ApiHttpError(400, "VALIDATION_FAILED", ["name must be shorter than or equal to 100 characters"]))).toEqual({
      name: "name must be shorter than or equal to 100 characters",
    });
    expect(validationFieldsFromError(new ApiHttpError(409, "NICKNAME_TAKEN"))).toEqual({});
    expect(validationFieldsFromError(new Error("boom"))).toEqual({});
  });
});

describe("nicknameInitials", () => {
  it("takes two code points and never leaves a lone surrogate", () => {
    expect(nicknameInitials("jaemin.inj")).toBe("JA");
    expect(nicknameInitials("a\u{1D400}bc")).toBe("A\u{1D400}");
    expect(nicknameInitials("\u{1D400}\u{1D401}\u{1D402}")).toBe("\u{1D400}\u{1D401}");
  });
});
