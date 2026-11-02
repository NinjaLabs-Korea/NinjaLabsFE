import { knownCode, type ErrorCopyKey } from "@/lib/api/error-copy";
import { ApiHttpError } from "@/lib/api/http";

type FormSurface = { readonly codes: readonly string[]; readonly fallback: string };

/** Keys the ladder adds on top of a surface's own codes (`<namespace>.saveErrors.<key>`). */
export type FormErrorKey<S extends FormSurface, Extra extends string = never> = ErrorCopyKey<S> | "network" | "session" | "invalid" | Extra;

/**
 * The one failed-save ladder of the member forms (sign-up profile, cohort application). The order is the rule:
 * not an HTTP answer -> `network`; 401 -> `session` (the refresh already failed, the form keeps what was typed); a BE code
 * the surface has copy for -> that code; `statusKeys[status]` (a status that means one thing on this form, e.g. a code-less
 * 409 = nickname taken) -> that key; 400/422 without a catalog code (class-validator) -> `invalid`; anything else -> the
 * surface `fallback`. A form passes its `ERROR_COPY` surface (the code list) and, at most, its `statusKeys`; it never repeats the ladder.
 */
export function formErrorKey<const S extends FormSurface, const Extra extends string = never>(
  error: unknown,
  surface: S,
  statusKeys: Readonly<Partial<Record<number, Extra>>> = {},
): FormErrorKey<S, Extra> {
  if (!(error instanceof ApiHttpError)) return "network";
  if (error.status === 401) return "session";
  const code = knownCode(error, surface.codes);
  if (code) return code as FormErrorKey<S, Extra>;
  const byStatus = statusKeys[error.status];
  if (byStatus) return byStatus;
  if (error.status === 400 || error.status === 422) return "invalid";
  return surface.fallback as FormErrorKey<S, Extra>;
}
