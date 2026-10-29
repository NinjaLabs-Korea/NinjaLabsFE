import type { ClientUser } from "@/lib/contracts/auth";
import { ApiHttpError, type ApiHttp } from "@/lib/api/http";
import { nicknameInitials } from "@/lib/nickname";

/** BE GET /auth/me 응답 (NinjaLabsBE docs/api-contract.md) */
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
  wallet: { address: string; verifiedAt: string } | null;
  nft: { status: string; tokenId: string | null } | null;
};

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

export async function readMe(http: ApiHttp): Promise<MeRead> {
  if (!http.hasSession()) return { me: null, unavailable: false };
  try {
    return { me: await http.fetchJson<MeResponse>("/auth/me"), unavailable: false };
  } catch (error) {
    // 만료·폐기된 세션은 로그아웃 상태로 취급. refresh가 일시 장애(REFRESH_UNAVAILABLE)여도
    // refresh 쿠키는 남아 있으므로 다음 401/다음 로드에서 세션이 복원된다. 호출 쪽은 `unavailable`로 "일시 장애"를 구분한다.
    return { me: null, unavailable: isTransientAuthFailure(error) };
  }
}

export async function fetchMe(http: ApiHttp): Promise<MeResponse | null> {
  return (await readMe(http)).me;
}
