/**
 * Onboarding profile draft kept across a session that ended mid-form: the sign-in goes through Google and back (same
 * tab), so sessionStorage survives it. Public profile text only, no secrets. The draft is tied to the user it was typed
 * for: another account signing in on the same tab never sees it.
 */
export const PROFILE_DRAFT_KEY = "ninja.profileDraft";

export type ProfileDraft = { nickname: string; bio: string; tags: string[] };

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function clearProfileDraft(): void {
  try {
    storage()?.removeItem(PROFILE_DRAFT_KEY);
  } catch {
    // ignore
  }
}

/** The draft of `userId`, or null. A draft of another user, or a legacy one without a user id, is removed. */
export function readProfileDraft(userId: string, knownTags: readonly string[]): ProfileDraft | null {
  try {
    const raw = storage()?.getItem(PROFILE_DRAFT_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") {
      clearProfileDraft();
      return null;
    }
    const { userId: owner, nickname, bio, tags } = value as Record<string, unknown>;
    if (owner !== userId) {
      clearProfileDraft();
      return null;
    }
    if (typeof nickname !== "string" || typeof bio !== "string" || !Array.isArray(tags)) return null;
    return { nickname, bio, tags: tags.filter((tag): tag is string => typeof tag === "string" && knownTags.includes(tag)) };
  } catch {
    return null;
  }
}

export function writeProfileDraft(userId: string, draft: ProfileDraft | null): void {
  try {
    if (draft) storage()?.setItem(PROFILE_DRAFT_KEY, JSON.stringify({ userId, ...draft }));
    else storage()?.removeItem(PROFILE_DRAFT_KEY);
  } catch {
    // storage blocked: the form on screen still keeps what was typed
  }
}
