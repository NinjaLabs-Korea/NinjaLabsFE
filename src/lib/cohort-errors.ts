import { ERROR_COPY, knownCode, listedCode, normalizedCode, type ErrorCopyKey } from "@/lib/api/error-copy";
import { ApiHttpError } from "@/lib/api/http";
import type { CohortFormErrors } from "@/lib/cohorts";
import { validationFieldsFromError } from "@/lib/api/validation";

/** Message key of a failed apply/update (`recruit.form.saveErrors.<key>`). */
export type CohortApplyErrorKey = ErrorCopyKey<typeof ERROR_COPY.cohortApply> | "network" | "session" | "invalid" | "questionsChanged";

/** The answers no longer fit the cohort's current questions (the operator edited the form while the applicant typed). Compared as a string: the code has no registry copy of its own. */
export const QUESTIONS_CHANGED_CODE = "COHORT_ANSWERS_INVALID";
const QUESTIONS_INVALID_CODE = "COHORT_QUESTIONS_INVALID";

export const isQuestionsChangedError = (error: unknown): boolean => error instanceof ApiHttpError && error.code === QUESTIONS_CHANGED_CODE;

/**
 * Failed apply/update -> message key. Order is the rule: not an HTTP answer -> `network`; 401 -> `session`; a BE code with its
 * own copy; 400/422 (class-validator, no catalog code) -> `invalid`; anything else -> `generic`.
 */
export function cohortApplyErrorKey(error: unknown): CohortApplyErrorKey {
  if (!(error instanceof ApiHttpError)) return "network";
  if (error.status === 401) return "session";
  if (error.code === QUESTIONS_CHANGED_CODE) return "questionsChanged";
  const code = knownCode(error, ERROR_COPY.cohortApply.codes);
  if (code) return code;
  if (error.status === 400 || error.status === 422) return "invalid";
  return ERROR_COPY.cohortApply.fallback;
}

/** Codes that mean the page's picture of the cohort or the application is stale: the caller re-reads both. */
export const STALE_COHORT_ERROR_CODES = [
  "COHORT_NOT_FOUND", "COHORT_NOT_ACCEPTING", "COHORT_ALREADY_APPLIED", "COHORT_APPLICATION_NOT_FOUND", "COHORT_APPLICATION_NOT_SUBMITTED",
] as const satisfies readonly (typeof ERROR_COPY.cohortApply.codes)[number][];

export function isStaleCohortError(error: unknown): boolean {
  return knownCode(error, STALE_COHORT_ERROR_CODES) !== null;
}

const FIELD_HINTS = ["displayName", "telegram", "twitter", "intro"] as const;

/** BE `400 VALIDATION_FAILED` message[] -> which fields to mark (`invalid`); never shows the English original. */
export function cohortFieldErrorsFromBe(error: unknown): CohortFormErrors {
  const rejected = validationFieldsFromError(error);
  return Object.fromEntries(FIELD_HINTS.filter((field) => Object.hasOwn(rejected, field)).map((field) => [field, "invalid"])) as CohortFormErrors;
}

/** Message key of a failed admin cohort action (`admin.recruitment.errors.<key>`); the question list's own code has no registry copy. */
export type CohortAdminErrorKey = ErrorCopyKey<typeof ERROR_COPY.adminCohort> | "questionsInvalid";

/** 401 and 429 are normalized by `normalizedCode`. */
export function cohortAdminErrorKey(error: unknown): CohortAdminErrorKey {
  if (error instanceof ApiHttpError && error.code === QUESTIONS_INVALID_CODE) return "questionsInvalid";
  return listedCode(normalizedCode(error), ERROR_COPY.adminCohort.codes) ?? ERROR_COPY.adminCohort.fallback;
}
