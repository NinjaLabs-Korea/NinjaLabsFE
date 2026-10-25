import type * as FoundationProviderModule from "@/components/auth/FoundationProvider";

/**
 * `@/components/auth/FoundationProvider` 목 모듈 단일 출처.
 *
 * 사용법 (각 테스트 파일 상단, vi.mock은 호이스팅되므로 팩토리 안에서 동적 import 한다):
 *   vi.mock("@/components/auth/FoundationProvider", async () =>
 *     (await import("./support/foundation")).foundationMock({ useAdminApi: () => api }));
 *
 * - 훅 "이름"은 실제 모듈의 export와 대조되어, 훅이 개명/삭제되면 tsc가 해당 테스트를 지목한다.
 *   반환값(부분 스텁)은 일부러 느슨하게 둔다: 테스트는 컴포넌트가 쓰는 메서드만 스텁한다.
 * - 값은 함수로 넘기므로 `state.auth` 같은 가변 상태를 렌더 시점에 읽는다.
 * - 목에 없는 훅을 컴포넌트가 부르면 vitest가 "no export" 에러를 내므로, 필요한 훅만 명시하면 된다.
 */
type FoundationHooks = { [Hook in keyof typeof FoundationProviderModule]?: () => unknown };

export function foundationMock(hooks: FoundationHooks): Record<string, unknown> {
  return hooks;
}
