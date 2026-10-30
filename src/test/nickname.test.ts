import { describe, expect, it } from "vitest";
import { ApiHttpError } from "@/lib/api/http";
import { validationFieldsFromError, validationFieldsFromMessages } from "@/lib/api/validation";
import { isReservedNickname, isValidNickname, NICKNAME, nicknameInitials, nicknameLength, normalizeNickname, validateNickname } from "@/lib/nickname";
import { STATIC_FILE_EXTENSIONS } from "@/lib/static-extensions";
import { BE_NICKNAME_ACCEPTED, BE_NICKNAME_REJECTED } from "./be-validator-fixtures";

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
    ["ninja<b>", "chars"], ["   ", "tooShort"], ["\u3164\u3164", "chars"], ["ninja\u115Fdev", "chars"], ["\uFFA0ninja", "chars"], ["​​", "chars"],
  ])("rejects %p as %s (length 2..50, no whitespace or symbols beyond _ . -)", (nickname, reason) => {
    expect(validateNickname(nickname)).toBe(reason);
  });

  it.each(["\u115F\u115F", "ninja\u3164dev", "\uFFA0ninja", "ninja\u1160"])(
    "rejects the invisible Hangul filler in %j as chars (BE nickname regex)",
    (nickname) => {
      expect(validateNickname(nickname)).toBe("chars");
    },
  );

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
    const astral = "𠮷"; // U+20BB7 CJK ideograph (not in the banned U+1D400 math block): \p{L}, two UTF-16 code units
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

describe("combining marks (BE `\\p{M}` rule: Hindi, Thai, stacked accents)", () => {
  it("is the same regex as the BE NICKNAME (copy of NinjaLabsBE src/users/nickname.ts, with the BE-3 homoglyph rule)", () => {
    expect(NICKNAME.source).toBe(
      "^(?!.*[\\p{Default_Ignorable_Code_Point}\\u115F\\u1160\\u3164\\uFFA0\\p{Variation_Selector}\\uFF00-\\uFFEF\\u{1D400}-\\u{1D7FF}])(?!.*[\\u0131\\u0237\\u0250-\\u02FF\\u1D00-\\u1DBF\\u2100-\\u218F\\uA730-\\uA7FF\\uAB30-\\uAB6F])(?!(?=.*[A-Za-z\\u00C0-\\u024F])(?=.*[\\p{Script=Cyrillic}\\p{Script=Greek}\\p{Script=Coptic}\\p{Script=Armenian}\\p{Script=Cherokee}\\p{Script=Lisu}\\p{Script=Georgian}\\p{Script=Canadian_Aboriginal}\\p{Script=Tifinagh}\\p{Script=Vai}\\p{Script=Glagolitic}\\p{Script=Osage}\\p{Script=Deseret}\\p{Script=Adlam}\\p{Script=Runic}\\p{Script=Ogham}]))(?!.*\\p{M}{4})(?!.*[_.-]\\p{M})[\\p{L}\\p{N}][\\p{L}\\p{N}\\p{M}_.-]*[\\p{L}\\p{N}\\p{M}]$",
    );
  });

  it.each(["हिन्दी", "ไทยแลนด์", "a\u0301\u0301\u0301b", "हिन्दी.हिन्दी"])("accepts %p", (nickname) => {
    expect(validateNickname(nickname)).toBeNull();
  });

  it.each([
    ["b\u0301\u0301\u0301\u0301c", "marks"],
    ["ab.\u0301c", "marks"],
    ["ab\uFE0F", "chars"],
    ["\u0301ab", "edge"],
  ])("rejects %p as %s", (nickname, reason) => {
    expect(validateNickname(nickname)).toBe(reason);
  });
});

describe("BE look-alike rules (fullwidth, math alphanumerics, mixed scripts, confusable reserved words)", () => {
  it.each(["ａbc12", "ＡＤＭＩＮ", "ａｄｍｉｎ", "𝐚bcd"])("rejects %p as lookalike, with a specific reason", (nickname) => {
    expect(validateNickname(nickname)).toBe("lookalike");
    expect(NICKNAME.test(nickname)).toBe(false);
  });

  it.each(["аdmin", "buіlderone", "αbc12", "coreոinja"])("rejects %p as a Latin + Latin-lookalike script mix", (nickname) => {
    expect(validateNickname(nickname)).toBe("mixedScript");
    expect(NICKNAME.test(nickname)).toBe(false);
  });

  it("still accepts single-script names and accented Latin", () => {
    for (const nickname of ["Привет", "Αθήνα", "café1", "Ñandú"]) expect(validateNickname(nickname), nickname).toBeNull();
  });

  it("folds confusable letters before the reserved-word check", () => {
    expect(isReservedNickname("аdmіn")).toBe(true);
    expect(isReservedNickname("ＡＤＭＩＮ")).toBe(true);
    expect(isReservedNickname("withdrawn_x")).toBe(true);
    expect(isReservedNickname("adminx")).toBe(false);
  });
});

describe("BE fixture tables (src/test/be-validator-fixtures.ts)", () => {
  it.each(BE_NICKNAME_REJECTED)("rejects %j like the BE", (nickname) => {
    expect(validateNickname(nickname)).not.toBeNull();
  });
  it.each(BE_NICKNAME_ACCEPTED)("accepts %j like the BE", (nickname) => {
    expect(validateNickname(nickname)).toBeNull();
  });
  it("reports a leading zero-width space as a character error, not a later BE 400", () => {
    expect(validateNickname("\u200Bninja")).toBe("chars");
    expect(validateNickname("coreni\u034Fnja")).toBe("chars");
  });
});
