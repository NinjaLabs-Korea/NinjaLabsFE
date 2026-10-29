import { ERROR_COPY, errorCopyKey, knownCode, type ErrorCopyKey } from "@/lib/api/error-copy";
import { ApiHttpError } from "@/lib/api/http";
import type { CohortFormErrors } from "@/lib/cohorts";
import { validationFieldsFromError } from "@/lib/api/validation";

/** Message key of a failed apply/update (`recruit.form.saveErrors.<key>`). */
export type CohortApplyErrorKey = ErrorCopyKey<typeof ERROR_COPY.cohortApply> | "network" | "session" | "invalid";

/**
 * Failed apply/update -> message key. Order is the rule: not an HTTP answer -> `network`; 401 -> `session`; a BE code with its
 * own copy; 400/422 (class-validator, no catalog code) -> `invalid`; anything else -> `generic`.
 */
export function cohortApplyErrorKey(error: unknown): CohortApplyErrorKey {
  if (!(error instanceof ApiHttpError)) return "network";
  if (error.status === 401) return "session";
  const code = knownCode(error, ERROR_COPY.cohortApply.codes);
  if (code) return code;
  if (error.status === 400 || error.status === 422) return "invalid";
  return ERROR_COPY.cohortApply.fallback;
}

/** Codes that mean the page's picture of the cohort or the application is stale: the caller re-reads both. */
export function isStaleCohortError(error: unknown): boolean {
  const code = knownCode(error, ERROR_COPY.cohortApply.codes);
  return code === "COHORT_NOT_FOUND" || code === "COHORT_NOT_ACCEPTING" || code === "COHORT_ALREADY_APPLIED" || code === "COHORT_APPLICATION_NOT_FOUND" || code === "COHORT_APPLICATION_NOT_SUBMITTED";
}

const FIELD_HINTS = ["displayName", "telegram", "twitter", "intro", "activityTypeOther", "interestOther"] as const;

/** BE `400 VALIDATION_FAILED` message[] -> which fields to mark (`invalid`); never shows the English original. */
export function cohortFieldErrorsFromBe(error: unknown): CohortFormErrors {
  const rejected = validationFieldsFromError(error);
  return Object.fromEntries(FIELD_HINTS.filter((field) => Object.hasOwn(rejected, field)).map((field) => [field, "invalid"])) as CohortFormErrors;
}

/** Message key of a failed admin cohort action (`admin.recruitment.errors.<key>`); 429 and 401 are normalized by status. */
export function cohortAdminErrorKey(error: unknown): ErrorCopyKey<typeof ERROR_COPY.adminCohort> {
  if (error instanceof ApiHttpError && error.status === 401) return "UNAUTHORIZED";
  return errorCopyKey(error, ERROR_COPY.adminCohort);
}
