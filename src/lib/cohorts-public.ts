import { toPublicCohort } from "@/lib/api/cohorts";
import { fetchPublicJson } from "@/lib/api/public";
import type { PublicCohort } from "@/lib/cohorts";

/** How long a static page may keep the cohort it was rendered with before the next request refreshes it (the browser read corrects it sooner). */
export const CURRENT_COHORT_REVALIDATE_SECONDS = 60;

/**
 * The open cohort (`GET /cohorts/current`, the same public endpoint the browser reads) for server-rendered pages, so the
 * recruitment slots render their final shape on first paint. `undefined` when the read failed or the API is unavailable
 * (mock mode): the page then keeps its reserved-slot behavior. No `headers()`/`cookies()`: the pages stay static (ISR).
 */
export async function getRuntimeCurrentCohort(): Promise<PublicCohort | null | undefined> {
  try {
    return toPublicCohort(await fetchPublicJson<PublicCohort | null>("/cohorts/current", { revalidateSeconds: CURRENT_COHORT_REVALIDATE_SECONDS }));
  } catch {
    return undefined;
  }
}
