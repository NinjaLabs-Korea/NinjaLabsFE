import {
  ACTIVITY_TYPES,
  INTEREST_AREAS,
  WEB3_EXPERIENCES,
  emptyCohortDraft,
  type ActivityType,
  type CohortFormDraft,
  type InterestArea,
  type Web3Experience,
} from "@/lib/cohorts";

/**
 * Per tab (sessionStorage) copy of an unsent cohort application, so a reload, back navigation or an expired session does not
 * lose the longest form in the product. Scoped to the user AND the cohort: another account in the same tab, or the next
 * cohort, never sees it. Every access is guarded: blocked storage just means no draft.
 */
const keyFor = (userId: string, cohortId: string) => `ninja.cohortDraft:${userId}:${cohortId}`;

const text = (value: unknown): string | null => (typeof value === "string" ? value : null);

export function readCohortDraft(userId: string, cohortId: string): CohortFormDraft | null {
  try {
    const raw = window.sessionStorage.getItem(keyFor(userId, cohortId));
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const v = value as Record<string, unknown>;
    const displayName = text(v.displayName);
    const telegram = text(v.telegram);
    const twitter = text(v.twitter);
    const intro = text(v.intro);
    if (displayName === null || telegram === null || twitter === null || intro === null) return null;
    const web3Experience = WEB3_EXPERIENCES.includes(v.web3Experience as Web3Experience) ? (v.web3Experience as Web3Experience) : "";
    const activityType = ACTIVITY_TYPES.includes(v.activityType as ActivityType) ? (v.activityType as ActivityType) : "";
    const interestAreas = Array.isArray(v.interestAreas)
      ? INTEREST_AREAS.filter((area): area is InterestArea => (v.interestAreas as unknown[]).includes(area))
      : [];
    return {
      ...emptyCohortDraft,
      displayName,
      telegram,
      twitter,
      web3Experience,
      activityType,
      activityTypeOther: text(v.activityTypeOther),
      interestAreas,
      interestOther: text(v.interestOther),
      intro,
    };
  } catch {
    return null;
  }
}

export function writeCohortDraft(userId: string, cohortId: string, draft: CohortFormDraft): void {
  try {
    window.sessionStorage.setItem(keyFor(userId, cohortId), JSON.stringify(draft));
  } catch {
    // storage blocked: the form on screen still keeps what was typed
  }
}

export function clearCohortDraft(userId: string, cohortId: string): void {
  try {
    window.sessionStorage.removeItem(keyFor(userId, cohortId));
  } catch {
    // nothing to clear
  }
}
