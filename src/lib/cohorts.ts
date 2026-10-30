// Fixture-free cohort (recruitment) types, option lists and the applicant-form rules. Client islands (`components/recruit/*`,
// `components/admin/Recruitment*`) and the api/mock clients import from here. The BE source of truth is
// `NinjaLabsBE/src/cohorts/{cohort-status,cohort-fields}.ts`; keep the lists below in step with it.
import {
  COHORT_DISPLAY_NAME_MAX,
  COHORT_INTRO_MAX,
  COHORT_OTHER_DETAIL_MAX,
} from "./input-limits";
import { hasVisibleText } from "./visible-text";

export const COHORT_STATUSES = ["DRAFT", "OPEN", "CLOSED"] as const;
export type CohortStatus = (typeof COHORT_STATUSES)[number];

export const COHORT_APPLICATION_STATUSES = ["SUBMITTED", "ACCEPTED", "REJECTED", "WITHDRAWN"] as const;
export type CohortApplicationStatus = (typeof COHORT_APPLICATION_STATUSES)[number];

/** Operator decisions; the decision is also the status afterwards (and an operator may change a decision later). */
export const COHORT_REVIEW_DECISIONS = ["ACCEPTED", "REJECTED"] as const;
export type CohortReviewDecision = (typeof COHORT_REVIEW_DECISIONS)[number];

/** Options, in the order of the Tally form. The code is the message key under `recruit.form.<field>.options`. */
export const WEB3_EXPERIENCES = ["LT_1Y", "Y1_3", "GT_3Y"] as const;
export type Web3Experience = (typeof WEB3_EXPERIENCES)[number];

export const ACTIVITY_TYPES = ["DEVELOPER", "CONTENT_CREATOR", "KOL", "COMMUNITY_MARKETING", "RESEARCHER", "BIZDEV", "STUDENT", "OTHER"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/** The interest areas are the activity types without STUDENT. */
export const INTEREST_AREAS = ["DEVELOPER", "CONTENT_CREATOR", "KOL", "COMMUNITY_MARKETING", "RESEARCHER", "BIZDEV", "OTHER"] as const;
export type InterestArea = (typeof INTEREST_AREAS)[number];

const OTHER = "OTHER";

export const isCohortStatus = (value: unknown): value is CohortStatus => COHORT_STATUSES.includes(value as CohortStatus);
export const isCohortApplicationStatus = (value: unknown): value is CohortApplicationStatus => COHORT_APPLICATION_STATUSES.includes(value as CohortApplicationStatus);

/** `GET /cohorts/current` (a JSON `null` when no cohort is open). */
export type PublicCohort = {
  id: string;
  name: string;
  description: string | null;
  opensAt: string | null;
  closesAt: string | null;
  acceptingApplications: boolean;
};

/** The applicant-form fields, exactly the Tally questions. */
export type CohortApplicationValues = {
  displayName: string;
  telegram: string;
  twitter: string;
  web3Experience: Web3Experience;
  activityType: ActivityType;
  activityTypeOther: string | null;
  interestAreas: InterestArea[];
  interestOther: string | null;
  intro: string;
};

/** `GET /cohorts/applications/me` row: no review note, no reviewer (the BE never sends them to the applicant). */
export type MyCohortApplication = CohortApplicationValues & {
  id: string;
  cohortId: string;
  cohort: { id: string; name: string; status: CohortStatus; acceptingApplications: boolean };
  status: CohortApplicationStatus;
  reviewedAt: string | null;
  /** SUBMITTED and the cohort still accepts: the PATCH is allowed. */
  editable: boolean;
  /** SUBMITTED: the withdraw is allowed (also after the cohort closed). */
  withdrawable: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminCohortCounts = Record<CohortApplicationStatus | "total", number>;

/** `GET /admin/cohorts` row. */
export type AdminCohort = {
  id: string;
  name: string;
  description: string | null;
  status: CohortStatus;
  opensAt: string | null;
  closesAt: string | null;
  acceptingApplications: boolean;
  applicationCounts: AdminCohortCounts;
  /** Next states the BE allows from here (`OPEN` can still answer 409 `COHORT_ALREADY_OPEN`). */
  allowedTransitions: Array<Exclude<CohortStatus, "DRAFT">>;
  createdAt: string;
  updatedAt: string;
};

/** Create/edit body: an empty description or window side is `null` (the BE clears the column). */
export type AdminCohortInput = {
  name: string;
  description: string | null;
  opensAt: string | null;
  closesAt: string | null;
};

export type AdminCohortApplication = CohortApplicationValues & {
  id: string;
  cohortId: string;
  status: CohortApplicationStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: { id: string; nickname: string; email: string };
};

export type AdminCohortApplicationFilter = {
  status?: CohortApplicationStatus;
  activityType?: ActivityType;
  interestArea?: InterestArea;
  q?: string;
};

export type AdminCohortApplicationPage = {
  items: AdminCohortApplication[];
  page: number;
  pageSize: number;
  total: number;
};

/** The `GET /admin/cohorts/:id/applications(.csv)` query string; the same filter feeds the table and the export. */
export function cohortApplicationQuery(filter: AdminCohortApplicationFilter, page?: number): string {
  const params = new URLSearchParams();
  if (filter.status) params.set("status", filter.status);
  if (filter.activityType) params.set("activityType", filter.activityType);
  if (filter.interestArea) params.set("interestArea", filter.interestArea);
  if (filter.q?.trim()) params.set("q", filter.q.trim());
  if (page !== undefined) params.set("page", String(page));
  const query = params.toString();
  return query ? `?${query}` : "";
}

// ── Applicant form ────────────────────────────────────────────────────

const TELEGRAM_URL = /^(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\/(.*)$/i;
const TWITTER_URL = /^(?:https?:\/\/)?(?:www\.|mobile\.)?(?:twitter\.com|x\.com)\/(.*)$/i;
const TELEGRAM_HANDLE = /^@[A-Za-z][A-Za-z0-9_]{4,31}$/;
const TWITTER_HANDLE = /^@[A-Za-z0-9_]{1,15}$/;

/**
 * Service paths that are not profiles (first segment, compared lowercased). Must match the BE
 * `RESERVED_PATHS` in `NinjaLabsBE/src/cohorts/cohort-fields.ts`; change both together.
 */
const RESERVED_PATHS: Record<"telegram" | "twitter", ReadonlySet<string>> = {
  telegram: new Set(["joinchat", "share", "addstickers", "addemoji", "addtheme", "addlist", "proxy", "socks", "c", "s", "iv", "login", "setlanguage", "confirmphone", "invoice", "boost", "m", "msg", "msg_url"]),
  twitter: new Set(["i", "intent", "home", "share", "search", "hashtag"]),
};

/**
 * Mirror of BE `normalizeHandle`: `name`, `@name`, `https://t.me/name`, `https://x.com/name?s=20` all become `@name`; blank stays blank.
 * A URL that is not a profile link (invite/share/post: more than one path segment, or a reserved first segment) is returned unchanged,
 * so the handle check fails on it instead of turning `t.me/joinchat/..` into `@joinchat`.
 */
export function normalizeHandle(raw: string, kind: "telegram" | "twitter"): string {
  let value = raw.trim();
  const url = (kind === "telegram" ? TELEGRAM_URL : TWITTER_URL).exec(value);
  if (url) {
    const segments = url[1].split(/[?#]/)[0].split("/").filter((segment) => segment !== "");
    if (segments.length > 1 || (segments.length === 1 && RESERVED_PATHS[kind].has(segments[0].toLowerCase()))) return value;
    value = segments[0] ?? "";
  }
  value = value.replace(/^@+/, "");
  return value === "" ? "" : `@${value}`;
}

/** Code points, like the BE `MaxChars` (Postgres length). */
const length = (value: string) => [...value].length;

export type CohortFieldError = "required" | "tooLong" | "invalid";
export type CohortFormErrors = Partial<Record<keyof CohortApplicationValues, CohortFieldError>>;

/** An empty form: nothing chosen yet (the select fields start empty, so the type of those two is widened here). */
export type CohortFormDraft = Omit<CohortApplicationValues, "web3Experience" | "activityType"> & {
  web3Experience: Web3Experience | "";
  activityType: ActivityType | "";
};

export const emptyCohortDraft: CohortFormDraft = {
  displayName: "",
  telegram: "",
  twitter: "",
  web3Experience: "",
  activityType: "",
  activityTypeOther: null,
  interestAreas: [],
  interestOther: null,
  intro: "",
};

/**
 * Pre-submit check, the mirror of the BE rules (`cohort-fields.ts`): required fields, handle shapes after normalization,
 * the "other" detail when "other" is picked, 60/1000 character limits. The BE stays the judge (a 400 maps to field hints).
 */
export function validateCohortDraft(draft: CohortFormDraft): CohortFormErrors {
  const errors: CohortFormErrors = {};
  const name = draft.displayName.trim();
  if (!name || !hasVisibleText(name)) errors.displayName = "required";
  else if (length(name) > COHORT_DISPLAY_NAME_MAX) errors.displayName = "tooLong";

  const telegram = normalizeHandle(draft.telegram, "telegram");
  if (!telegram) errors.telegram = "required";
  else if (!TELEGRAM_HANDLE.test(telegram)) errors.telegram = "invalid";

  const twitter = normalizeHandle(draft.twitter, "twitter");
  if (!twitter) errors.twitter = "required";
  else if (!TWITTER_HANDLE.test(twitter)) errors.twitter = "invalid";

  if (!draft.web3Experience) errors.web3Experience = "required";
  if (!draft.activityType) errors.activityType = "required";
  if (draft.activityType === OTHER) {
    const other = draft.activityTypeOther?.trim() ?? "";
    if (!other) errors.activityTypeOther = "required";
    else if (length(other) > COHORT_OTHER_DETAIL_MAX) errors.activityTypeOther = "tooLong";
  }
  if (draft.interestAreas.length === 0) errors.interestAreas = "required";
  if (draft.interestAreas.includes(OTHER)) {
    const other = draft.interestOther?.trim() ?? "";
    if (!other) errors.interestOther = "required";
    else if (length(other) > COHORT_OTHER_DETAIL_MAX) errors.interestOther = "tooLong";
  }
  const intro = draft.intro.trim();
  if (!intro || !hasVisibleText(intro)) errors.intro = "required";
  else if (length(intro) > COHORT_INTRO_MAX) errors.intro = "tooLong";
  return errors;
}

/** The request body for a draft that passed `validateCohortDraft`: trimmed, handles normalized, unused "other" details dropped. */
export function draftToValues(draft: CohortFormDraft): CohortApplicationValues | null {
  if (!draft.web3Experience || !draft.activityType) return null;
  return {
    displayName: draft.displayName.trim(),
    telegram: normalizeHandle(draft.telegram, "telegram"),
    twitter: normalizeHandle(draft.twitter, "twitter"),
    web3Experience: draft.web3Experience,
    activityType: draft.activityType,
    activityTypeOther: draft.activityType === OTHER ? draft.activityTypeOther?.trim() || null : null,
    interestAreas: INTEREST_AREAS.filter((area) => draft.interestAreas.includes(area)),
    interestOther: draft.interestAreas.includes(OTHER) ? draft.interestOther?.trim() || null : null,
    intro: draft.intro.trim(),
  };
}

export function valuesToDraft(values: CohortApplicationValues): CohortFormDraft {
  return { ...values, interestAreas: [...values.interestAreas] };
}

/**
 * Whether the apply form is the right thing to show for the cohort and the viewer's own application.
 * `form`: no (or a withdrawn) application and the cohort accepts. `not-accepting`: no usable application and it does not. The rest follow the application.
 */
export type CohortApplyView =
  | { kind: "form"; reapply: boolean }
  | { kind: "not-accepting" }
  | { kind: "submitted"; application: MyCohortApplication }
  | { kind: "accepted"; application: MyCohortApplication }
  | { kind: "rejected"; application: MyCohortApplication };

export function resolveCohortApplyView(cohort: PublicCohort, mine: readonly MyCohortApplication[]): CohortApplyView {
  const application = mine.find((item) => item.cohortId === cohort.id);
  if (!application || application.status === "WITHDRAWN") {
    return cohort.acceptingApplications ? { kind: "form", reapply: application !== undefined } : { kind: "not-accepting" };
  }
  if (application.status === "ACCEPTED") return { kind: "accepted", application };
  if (application.status === "REJECTED") return { kind: "rejected", application };
  return { kind: "submitted", application };
}

/** How to describe an open cohort: `open` accepts applications, `upcoming` has an opening time in the future, `closed` is past its window. */
export function cohortPhase(cohort: Pick<PublicCohort, "acceptingApplications" | "opensAt">, now: number = Date.now()): "open" | "upcoming" | "closed" {
  if (cohort.acceptingApplications) return "open";
  return cohort.opensAt !== null && Date.parse(cohort.opensAt) > now ? "upcoming" : "closed";
}
