// The member-facing form field recipes (sign-up profile, cohort application, account, bounty apply/submit). Admin forms have their own
// (`admin/ops-ui.ts` opsInput). Two looks on purpose: `roomyField` (padded, the sign-up/cohort/account forms, also used for textareas)
// and `compactField` (46px one-line, the bounty apply/submit panels, the height of the admin fields). Both paint the red border while
// the field is `aria-invalid`. Do not copy these strings into a form: import them, and add a line here when a third look is needed.
const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const INVALID_BORDER = "aria-[invalid]:border-danger";
const FIELD_BASE = "w-full rounded-control border border-border bg-surface placeholder:text-ink-placeholder";

/** Padded field. A textarea adds its own `min-h-[...]` at the call site. */
export const roomyField = `mt-2 ${FIELD_BASE} px-4 py-3 text-sm text-ink-secondary ${FOCUS_RING} ${INVALID_BORDER}`;
/** One-line 46px field of the bounty panels. */
export const compactField = `h-[46px] ${FIELD_BASE} px-3 text-sm text-ink focus-visible:outline-solid ${FOCUS_RING} ${INVALID_BORDER}`;
/** Multi-line field of the bounty panels; the call site adds `min-h-...`. */
export const compactTextarea = `${FIELD_BASE} px-3 py-3 text-sm text-ink focus-visible:outline-solid ${FOCUS_RING} ${INVALID_BORDER}`;
