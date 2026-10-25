/// <reference types="vite/client" />
// 에러 문구 레지스트리(`lib/api/error-copy.ts`)의 규칙을 문서화하는 테스트.
// 화면에 코드를 추가했는데 여기서 실패하면: 그 화면의 messages 객체에 코드와 같은 이름의 en 키를 추가하라 (ko/zh는 parity 테스트).
import { describe, expect, it } from "vitest";
import { saveErrorKey } from "@/components/signup/ProfileForm";
import { BE_ERROR_CODES } from "@/lib/api/be-error-codes";
import {
  ERROR_COPY,
  FE_ERROR_CODES,
  KNOWN_ERROR_CODES,
  errorCopyKey,
  knownCode,
  listedCode,
  type ErrorCopySurface,
} from "@/lib/api/error-copy";
import { ApiHttpError } from "@/lib/api/http";
import { MockApiError } from "@/lib/mocks/mock-error";

const enFiles = import.meta.glob("../../messages/en/*.json", { eager: true, import: "default" }) as Record<string, unknown>;
const en: Record<string, unknown> = Object.fromEntries(
  Object.entries(enFiles).map(([path, messages]) => [path.replace(/^.*\/(\w+)\.json$/, "$1"), messages]),
);

/** `account.settings.deleteErrors` → en 메시지 객체 (없으면 undefined) */
function messagesAt(path: string): Record<string, unknown> | undefined {
  let node: unknown = en;
  for (const part of path.split(".")) {
    if (!node || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node && typeof node === "object" ? (node as Record<string, unknown>) : undefined;
}

const surfaces = Object.entries(ERROR_COPY) as Array<[string, ErrorCopySurface]>;

describe("BE error code snapshot (lib/api/be-error-codes.ts)", () => {
  it("is a duplicate-free list of UPPER_SNAKE codes", () => {
    expect(new Set(BE_ERROR_CODES).size).toBe(BE_ERROR_CODES.length);
    for (const code of BE_ERROR_CODES) expect(code).toMatch(/^[A-Z][A-Z0-9_]*$/);
  });

  it("includes INVALID_DATE (400 for a calendar-impossible date) and the admin write toasts explain it", () => {
    expect(BE_ERROR_CODES as readonly string[]).toContain("INVALID_DATE");
    expect(ERROR_COPY.adminWrite.codes as readonly string[]).toContain("INVALID_DATE");
  });

  it("includes DEPOSIT_BELOW_REWARD_AMOUNT (400 for a below-amount deposit) and the operations console explains it", () => {
    expect(BE_ERROR_CODES as readonly string[]).toContain("DEPOSIT_BELOW_REWARD_AMOUNT");
    expect(ERROR_COPY.adminOperations.codes as readonly string[]).toContain("DEPOSIT_BELOW_REWARD_AMOUNT");
  });

  it("keeps FE-made codes separate from BE codes", () => {
    for (const code of FE_ERROR_CODES) expect(BE_ERROR_CODES as readonly string[], code).not.toContain(code);
  });
});

describe("error copy registry (lib/api/error-copy.ts)", () => {
  it.each(surfaces)("%s only lists codes from the BE snapshot or FE_ERROR_CODES, once each", (_name, surface) => {
    expect(new Set(surface.codes).size).toBe(surface.codes.length);
    for (const code of surface.codes) expect(KNOWN_ERROR_CODES, code).toContain(code);
  });

  it.each(surfaces)("%s has an en message for every code, keyed by the code itself, plus its fallback", (_name, surface) => {
    const messages = messagesAt(surface.messages);
    expect(messages, surface.messages).toBeDefined();
    for (const code of surface.codes) {
      expect(typeof messages?.[code], `${surface.messages}.${code}`).toBe("string");
      expect(messages?.[code], `${surface.messages}.${code}`).not.toBe("");
    }
    if (surface.fallback) expect(typeof messages?.[surface.fallback], `${surface.messages}.${surface.fallback}`).toBe("string");
  });
});

describe("knownCode / errorCopyKey", () => {
  const codes = ["AGENT_NOT_ACTIVE", "DATABASE_UNAVAILABLE"] as const;

  it("returns a listed BE code from an ApiHttpError (mock errors included)", () => {
    expect(knownCode(new ApiHttpError(409, "AGENT_NOT_ACTIVE"), codes)).toBe("AGENT_NOT_ACTIVE");
    expect(knownCode(new MockApiError(503, "DATABASE_UNAVAILABLE"), codes)).toBe("DATABASE_UNAVAILABLE");
  });

  it("returns null for unlisted codes and non-HTTP failures (no duck typing on `.code`)", () => {
    expect(knownCode(new ApiHttpError(409, "AGENT_ALREADY_VERIFIED"), codes)).toBeNull();
    expect(knownCode(new TypeError("Failed to fetch"), codes)).toBeNull();
    expect(knownCode({ code: "AGENT_NOT_ACTIVE" }, codes)).toBeNull();
    expect(knownCode(null, codes)).toBeNull();
  });

  it("matches the whole code, never a substring", () => {
    expect(knownCode(new ApiHttpError(400, "CONFIRM_NICKNAME_MISMATCH"), ERROR_COPY.profileSave.codes)).toBeNull();
    expect(listedCode("AGENT_NOT_ACTIVE_X", codes)).toBeNull();
    expect(listedCode(null, codes)).toBeNull();
  });

  it("falls back to the surface's fallback key", () => {
    expect(errorCopyKey(new ApiHttpError(409, "AGENT_NOT_ACTIVE"), ERROR_COPY.agentRotate)).toBe("AGENT_NOT_ACTIVE");
    expect(errorCopyKey(new ApiHttpError(404, "AGENT_NOT_FOUND"), ERROR_COPY.agentRotate)).toBe("generic");
    expect(errorCopyKey(new TypeError("Failed to fetch"), ERROR_COPY.applicationWithdraw)).toBe("generic");
  });
});

describe("profile save error rules (ProfileForm.saveErrorKey)", () => {
  it.each([
    ["a network failure", new TypeError("Failed to fetch"), "network"],
    ["401 (session ended)", new ApiHttpError(401, "INVALID_REFRESH_TOKEN"), "session"],
    ["409 NICKNAME_TAKEN", new ApiHttpError(409, "NICKNAME_TAKEN"), "NICKNAME_TAKEN"],
    ["a 409 without a known code", new ApiHttpError(409, "UNKNOWN_ERROR"), "NICKNAME_TAKEN"],
    ["400 INVALID_CHARACTER", new ApiHttpError(400, "INVALID_CHARACTER"), "INVALID_CHARACTER"],
    ["400 REFERENCE_NOT_FOUND", new ApiHttpError(400, "REFERENCE_NOT_FOUND"), "REFERENCE_NOT_FOUND"],
    ["503 DATABASE_UNAVAILABLE", new ApiHttpError(503, "DATABASE_UNAVAILABLE"), "DATABASE_UNAVAILABLE"],
    ["400 VALIDATION_FAILED", new ApiHttpError(400, "VALIDATION_FAILED", ["bio should not be empty"]), "invalid"],
    ["a 500", new ApiHttpError(500, "UNKNOWN_ERROR"), "generic"],
  ])("maps %s", (_label, error, key) => {
    expect(saveErrorKey(error)).toBe(key);
  });
});
