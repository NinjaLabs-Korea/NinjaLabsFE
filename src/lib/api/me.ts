import type { ClientUser } from "@/lib/contracts/auth";
import type { ApiHttp } from "@/lib/api/http";

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
    initials: me.nickname.slice(0, 2).toUpperCase(),
    profileSlug: me.nickname,
    onboardingStep: me.onboardingStep,
    onboardingCompleted: me.onboardingCompleted,
    isAdmin: me.isAdmin,
    ...(me.wallet ? { walletAddress: me.wallet.address } : {}),
  };
}

export async function fetchMe(http: ApiHttp): Promise<MeResponse | null> {
  if (!http.hasSession()) return null;
  try {
    return await http.fetchJson<MeResponse>("/auth/me");
  } catch {
    // 만료·폐기된 세션은 로그아웃 상태로 취급. refresh가 일시 장애(REFRESH_UNAVAILABLE)여도
    // refresh 쿠키는 남아 있으므로 UI만 signed-out이 되고 다음 401/다음 로드에서 세션이 복원된다.
    return null;
  }
}
