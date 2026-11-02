import { describe, expect, it } from "vitest";
import { ApiHttpError } from "@/lib/api/http";
import { formErrorKey } from "@/lib/api/form-error-key";

const surface = { codes: ["COHORT_NOT_FOUND", "TOO_MANY_REQUESTS"], fallback: "generic" } as const;

describe("formErrorKey (the shared failed-save ladder of the member forms)", () => {
  it("climbs in order: network, 401 session, listed code, status key, 400/422 invalid, fallback", () => {
    expect(formErrorKey(new TypeError("Failed to fetch"), surface)).toBe("network");
    expect(formErrorKey(new ApiHttpError(401, "COHORT_NOT_FOUND"), surface)).toBe("session");
    expect(formErrorKey(new ApiHttpError(404, "COHORT_NOT_FOUND"), surface)).toBe("COHORT_NOT_FOUND");
    expect(formErrorKey(new ApiHttpError(429, "ThrottlerException: Too Many Requests"), surface)).toBe("TOO_MANY_REQUESTS");
    expect(formErrorKey(new ApiHttpError(400, "VALIDATION_FAILED"), surface)).toBe("invalid");
    expect(formErrorKey(new ApiHttpError(422, "WHATEVER"), surface)).toBe("invalid");
    expect(formErrorKey(new ApiHttpError(500, "UNKNOWN_ERROR"), surface)).toBe("generic");
  });

  it("lets a form give one status its own key, below the listed codes and above the generic 400/422", () => {
    const keys = { 409: "TAKEN", 400: "BAD" } as const;
    expect(formErrorKey(new ApiHttpError(409, "SOMETHING"), surface, keys)).toBe("TAKEN");
    expect(formErrorKey(new ApiHttpError(409, "COHORT_NOT_FOUND"), surface, keys)).toBe("COHORT_NOT_FOUND");
    expect(formErrorKey(new ApiHttpError(400, "X"), surface, keys)).toBe("BAD");
    expect(formErrorKey(new ApiHttpError(409, "SOMETHING"), surface)).toBe("generic");
  });
});
