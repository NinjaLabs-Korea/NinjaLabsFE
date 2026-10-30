import { isHttpUrl } from "@/lib/url-rules";
import { hasVisibleText } from "@/lib/visible-text";

/** Per-field problems the form finds itself (before any request): a link that is not http(s), or a required text left empty. */
export type FieldError = "url" | "required";
export type FieldErrors = Partial<Record<string, FieldError>>;
export type FormFieldRule = { name: string; kind: "url" | "text"; required?: boolean };

export const APPLY_FIELDS: FormFieldRule[] = [
  { name: "portfolioUrl", kind: "url" },
  { name: "message", kind: "text", required: true },
];
export const SUBMIT_FIELDS: FormFieldRule[] = [
  { name: "submissionUrl", kind: "url", required: true },
  { name: "repositoryUrl", kind: "url" },
  { name: "description", kind: "text", required: true },
];

/** A rule looked up by field name, so reordering or inserting rules cannot hand an input another field's rule. */
export function ruleFor(rules: FormFieldRule[], name: string): FormFieldRule {
  const rule = rules.find((candidate) => candidate.name === name);
  if (!rule) throw new Error(`No form rule for field ${name}`);
  return rule;
}

/** The same rule the API applies (`isHttpUrl`, mirror of the BE), so the person sees the locale message instead of the browser's tooltip. */
export function fieldProblem(rule: FormFieldRule, raw: string): FieldError | undefined {
  // Text is empty when it has no visible character (the BE rule, `lib/visible-text.ts`); only a URL is trimmed.
  if (rule.kind === "text") return rule.required && !hasVisibleText(raw) ? "required" : undefined;
  const value = raw.trim();
  if (!value) return rule.required ? "required" : undefined;
  return !isHttpUrl(value) ? "url" : undefined;
}

/** Checks every rule against the submitted values: the problem per field name (undefined when fine) and the first field with a problem. */
export function validateFields(form: FormData, rules: FormFieldRule[]): { errors: FieldErrors; first: FormFieldRule | undefined } {
  const errors: FieldErrors = {};
  for (const rule of rules) errors[rule.name] = fieldProblem(rule, String(form.get(rule.name) ?? ""));
  return { errors, first: rules.find((rule) => errors[rule.name]) };
}
