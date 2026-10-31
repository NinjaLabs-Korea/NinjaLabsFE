import { describe, expect, it } from "vitest";
import { APPLY_FIELDS, SUBMIT_FIELDS, fieldProblem, ruleFor, validateFields } from "@/lib/form-field-rules";

const formOf = (values: Record<string, string>) => {
  const form = new FormData();
  for (const [name, value] of Object.entries(values)) form.set(name, value);
  return form;
};

describe("form field rules", () => {
  it("looks a rule up by name and throws for an unknown field", () => {
    expect(ruleFor(APPLY_FIELDS, "message")).toMatchObject({ kind: "text", required: true });
    expect(() => ruleFor(APPLY_FIELDS, "nope")).toThrow("No form rule for field nope");
  });

  it("flags a required text with no visible character", () => {
    const rule = ruleFor(APPLY_FIELDS, "message");
    expect(fieldProblem(rule, "")).toBe("required");
    expect(fieldProblem(rule, "   \n ")).toBe("required");
    expect(fieldProblem(rule, "hello")).toBeUndefined();
  });

  it("accepts an empty optional link and flags a required empty one", () => {
    expect(fieldProblem(ruleFor(APPLY_FIELDS, "portfolioUrl"), "  ")).toBeUndefined();
    expect(fieldProblem(ruleFor(SUBMIT_FIELDS, "submissionUrl"), "")).toBe("required");
  });

  it("flags a link that is not http(s) and accepts a valid one (trimmed)", () => {
    const rule = ruleFor(SUBMIT_FIELDS, "repositoryUrl");
    expect(fieldProblem(rule, "ftp://example.com")).toBe("url");
    expect(fieldProblem(rule, "not a url")).toBe("url");
    expect(fieldProblem(rule, "  https://example.com/a  ")).toBeUndefined();
  });

  it("validates a mixed field set and reports the first problem in rule order", () => {
    const result = validateFields(formOf({ submissionUrl: "https://ok.dev", repositoryUrl: "bad", description: "" }), SUBMIT_FIELDS);
    expect(result.errors).toEqual({ submissionUrl: undefined, repositoryUrl: "url", description: "required" });
    expect(result.first?.name).toBe("repositoryUrl");
  });

  it("reports no first problem when every field is fine", () => {
    const result = validateFields(formOf({ submissionUrl: "https://ok.dev", description: "done" }), SUBMIT_FIELDS);
    expect(result.first).toBeUndefined();
  });
});
