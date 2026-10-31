import type { ClientUser } from "@/lib/contracts/auth";
import { ApiHttpError, type ApiHttp } from "@/lib/api/http";
import { nicknameInitials } from "@/lib/nickname";
import { onboardingLog } from "@/lib/onboarding-log";

/** BE GET /auth/me 응답 (NinjaLabsBE docs/api-contract.md). 쿠키 모드 refresh/exchange 응답의 `user`도 같은 객체다. */
export type MeResponse = {
  id: string;
  nickname: string;
  email: string;
  bio: string;
  tags: string[];
  onboardingStep: number;
  onboardingCompleted: boolean;
  isAdmin: boolean;
  isMember: boolean;
  wallet: { address: string; verifiedAt: string | null } | null;
  nft: { status: string; tokenId: string | null } | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string";
const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";

/**
 * Codec for the `user` a cookie-mode refresh/exchange carries (BE: the same `getMe` that answers `GET /auth/me`).
 * Anything that does not have the full `/auth/me` shape (an older BE without the field, a partial or malformed object)
 * is `null`, and the caller falls back to `GET /auth/me` exactly as before. Only a value that passes is trusted to skip it.
 */
export function parseMeResponse(value: unknown): MeResponse | null {
  if (!isRecord(value)) return null;
  const { wallet, nft, tags } = value;
  const ok =
    isString(value.id) && value.id !== "" &&
    isString(value.nickname) && value.nickname !== "" &&
    isString(value.email) &&
    isString(value.bio) &&
    Array.isArray(tags) && tags.every(isString) &&
    typeof value.onboardingStep === "number" && Number.isInteger(value.onboardingStep) &&
    isBoolean(value.onboardingCompleted) &&
    isBoolean(value.isAdmin) &&
    isBoolean(value.isMember) &&
    (wallet === null || (isRecord(wallet) && isString(wallet.address) && (wallet.verifiedAt === null || isString(wallet.verifiedAt)))) &&
    (nft === null || (isRecord(nft) && isString(nft.status) && (nft.tokenId === null || isString(nft.tokenId))));
  return ok ? (value as MeResponse) : null;
}

export function toClientUser(me: MeResponse): ClientUser {
  return {
    id: me.id,
    handle: me.nickname,
    initials: nicknameInitials(me.nickname),
    profileSlug: me.nickname,
    onboardingStep: me.onboardingStep,
    onboardingCompleted: me.onboardingCompleted,
    isAdmin: me.isAdmin,
    bio: me.bio,
    tags: me.tags,
    nftStatus: me.nft?.status ?? null,
    ...(me.wallet ? { walletAddress: me.wallet.address } : {}),
  };
}

/**
 * `GET /auth/me` result. `me: null` means there is no usable session (never signed in, or the BE rejected it);
 * `unavailable` additionally says the read failed for a reason that leaves the session alone (network error, 5xx, 429,
 * or `REFRESH_UNAVAILABLE` from a refresh the BE could not answer), so the UI must not claim "signed out".
 */
export type MeRead = { me: MeResponse | null; unavailable: boolean };

/** A failure that says nothing about the session: everything except the BE rejecting it (4xx other than 429). */
export function isTransientAuthFailure(error: unknown): boolean {
  return !(error instanceof ApiHttpError && error.status >= 400 && error.status < 500 && error.status !== 429);
}

/**
 * @param sessionUser the `user` the refresh/exchange that started this session carried (`RefreshResult.user`). When it
 *   passes `parseMeResponse` it is the `/auth/me` answer for this very session and the round trip is skipped; otherwise
 *   (older BE, malformed) `GET /auth/me` runs as before. Never used without a live session in this tab.
 */
export async function readMe(http: ApiHttp, sessionUser?: unknown): Promise<MeRead> {
  if (!http.hasSession()) return { me: null, unavailable: false };
  const carried = sessionUser === undefined ? null : parseMeResponse(sessionUser);
  if (carried) {
    onboardingLog("session.me.carried", { source: "refresh" });
    return { me: carried, unavailable: false };
  }
  if (sessionUser !== undefined) onboardingLog("session.me.carried", { source: "fallback", reason: "INVALID_USER" });
  try {
    return { me: await http.fetchJson<MeResponse>("/auth/me"), unavailable: false };
  } catch (error) {
    // 만료·폐기된 세션은 로그아웃 상태로 취급. refresh가 일시 장애(REFRESH_UNAVAILABLE)여도
    // refresh 쿠키는 남아 있으므로 다음 401/다음 로드에서 세션이 복원된다. 호출 쪽은 `unavailable`로 "일시 장애"를 구분한다.
    return { me: null, unavailable: isTransientAuthFailure(error) };
  }
}

export async function fetchMe(http: ApiHttp, sessionUser?: unknown): Promise<MeResponse | null> {
  return (await readMe(http, sessionUser)).me;
}
