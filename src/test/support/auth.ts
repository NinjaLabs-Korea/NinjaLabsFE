import type { AuthSnapshot, ClientUser, SignedInAuthSnapshot } from "@/lib/contracts/auth";

/**
 * 테스트용 AuthSnapshot 단일 출처. 파일마다 `{ status: "signed-in", user: {...} }`를 손으로 만들지 말고 여기서 가져온다.
 * 로그인 사용자 모양(ClientUser)이 바뀌면 이 파일 한 곳만 고치면 된다.
 * 실제 mock 시드 사용자(previewUser)가 필요한 테스트는 `@/lib/mocks/fixtures`의 previewUser를 `signedInAs()`에 넘긴다.
 */

/** 최소 로그인 사용자. 공유 상수라 freeze 해 두었다(테스트 간 변이 방지): 바꿀 땐 signedInWith로 복사본을 만든다.
 * 필요한 필드는 `signedInWith({ ... })`로 덮어쓴다. */
export const testUser: ClientUser = Object.freeze({ id: "user-1", handle: "ninja", initials: "NI", profileSlug: "ninja" });

export const signedOut: AuthSnapshot = Object.freeze({ status: "signed-out", user: null });
export const loading: AuthSnapshot = Object.freeze({ status: "loading", user: null });

/** testUser로 로그인한 기본 스냅샷. 상태를 바꾸지 않는 테스트는 이 상수를 그대로 쓴다. */
export const signedIn: SignedInAuthSnapshot = Object.freeze({ status: "signed-in", user: testUser });

/** 일부 필드만 다른 로그인 스냅샷. `overrides`는 testUser 위에 얕게 병합된다. */
export const signedInWith = (overrides: Partial<ClientUser>): SignedInAuthSnapshot => ({
  status: "signed-in",
  user: { ...testUser, ...overrides },
});

/** 주어진 사용자(예: previewUser)로 로그인한 스냅샷. */
export const signedInAs = (user: ClientUser): SignedInAuthSnapshot => ({ status: "signed-in", user });
