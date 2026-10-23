import { describe, expect, it } from "vitest";
import { ApiHttpError } from "@/lib/api/http";
import { validationFieldsFromError, validationFieldsFromMessages } from "@/lib/api/validation";
import { isReservedNickname, isValidNickname, NICKNAME, nicknameLength, validateNickname } from "@/lib/nickname";

// Probe cases mirror NinjaLabsBE `src/users/users.dto.spec.ts` (CompleteProfileDto) - keep the two files in step.
describe("nickname rule (mirror of BE users/nickname.ts)", () => {
  it("accepts unicode letters/digits with _ . - and trims surrounding whitespace", () => {
    expect(validateNickname("ninja_dev")).toBeNull();
    expect(validateNickname("닌자.개발자-01")).toBeNull();
    expect(validateNickname("  ninja  ")).toBeNull();
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

  it.each(["me", "ME", "Me", "check-nickname", "Check-Nickname", "admin", "ADMIN", "new", "New", "edit", "EDIT", "  me  "])(
    "rejects the reserved route word %p (case-insensitive)",
    (nickname) => {
      expect(isReservedNickname(nickname)).toBe(true);
      expect(validateNickname(nickname)).toBe("reserved");
    },
  );
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
