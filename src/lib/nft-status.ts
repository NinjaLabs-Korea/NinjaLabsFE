/**
 * NFT 상태 집합과 공개 표시 규칙의 단일 출처 (React 없음). BE 상수의 **복사본(snapshot)**이다.
 *
 * 원본: NinjaLabsBE `src/nfts/nft-status.ts` (`NFT_STATUSES`, `MINTED_OR_LATER`). 스냅샷 기준: BE `origin/main` @ `dc0ee2a`
 * (원본 파일의 마지막 변경 커밋 `a2b7f38`). 전이: PENDING -> MINTING -> MINTED -> ATTACHING -> ATTACHED, 5회 실패하면 FAILED.
 *
 * 쓰는 곳: 공개 프로필 NFT 타일(`app/[locale]/members/[id]/page.tsx`), `/home` 내 카드(`components/home/HomeProfileCard.tsx`).
 * FAILED는 어드민 `/admin/nft-jobs`에서만 다룬다. 방문자와 본인에게는 "발행 중"으로 접는다(2026-10-30 결정).
 *
 * ## 어디를 고치나
 * - BE가 상태를 바꿨을 때: 원본을 열어 아래 배열을 맞추고 기준 커밋을 갱신한다. `src/test/nft-status.test.ts`가 스냅샷과
 *   모든 상태의 표시 결과를 고정한다(상태 추가를 일부러 하게 만드는 장치). 모르는 값은 항상 "발행 중"으로 읽는다.
 */

/** BE nft.status CHECK와 같은 전체 상태 */
export const NFT_STATUSES = ["PENDING", "MINTING", "MINTED", "ATTACHING", "ATTACHED", "FAILED"] as const;
export type NftStatus = (typeof NFT_STATUSES)[number];

/** 민팅이 끝난 상태 (BE `MINTED_OR_LATER`) */
export const MINTED_OR_LATER: readonly NftStatus[] = ["MINTED", "ATTACHING", "ATTACHED"];

/** 공개 프로필 NFT 타일 라벨 키 (`members.nftStatus.<key>`). `null` = 라벨 없음(완전히 붙은 정상 타일) */
export type PublicNftStatusKey = "minting" | "minted";

/**
 * 방문자는 "진행 중"과 "완료"만 알면 된다. PENDING, MINTING, ATTACHING, FAILED와 BE가 나중에 추가할 값은 모두 "minting",
 * MINTED만 "minted", ATTACHED는 라벨 없음.
 */
export function publicNftStatusKey(status: string): PublicNftStatusKey | null {
  if (status === "ATTACHED") return null;
  if (status === "MINTED") return "minted";
  return "minting";
}

/** `/home` 내 카드 배지 키 (`home.profile.nft.<key>`) */
export type OwnerNftBadgeKey = "minted" | "pending";

/**
 * 본인 카드: 민팅이 끝난 상태(MINTED, ATTACHING, ATTACHED)만 "minted"(발행 완료). FAILED와 모르는 값은 "pending"이라
 * 발행됐다고 말하지 않고 오류도 보이지 않는다. (ATTACHING이 공개 타일에서는 "minting"인 것과 다르다: 현재 동작 유지.)
 */
export function ownerNftBadgeKey(status: string): OwnerNftBadgeKey {
  return (MINTED_OR_LATER as readonly string[]).includes(status) ? "minted" : "pending";
}
