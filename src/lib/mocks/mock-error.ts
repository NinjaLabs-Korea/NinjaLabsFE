import { ApiHttpError } from "@/lib/api/http";

/**
 * BE 오류 응답을 흉내 내는 mock 오류. `ApiHttpError`를 상속하므로 컴포넌트의 `instanceof ApiHttpError` /
 * `error.code` 분기가 mock 모드에서도 api 모드와 같은 경로를 탄다.
 */
export class MockApiError extends ApiHttpError {
  constructor(status: number, code: string) {
    super(status, code);
    this.name = "MockApiError";
  }
}
