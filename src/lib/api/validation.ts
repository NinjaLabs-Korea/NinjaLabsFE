import { ApiHttpError } from "@/lib/api/http";

/**
 * BE(Nest ValidationPipe) `400 { message: string[] }` → 필드별 힌트.
 *
 * class-validator의 기본 메시지는 `<property> must …` / `<property> should not be empty` / `<property> is a reserved word`처럼
 * 속성 이름으로 시작한다 (중첩 DTO는 `reward.amount must …`). 첫 토큰을 속성으로 읽고, 같은 필드의 첫 메시지만 남긴다.
 * 화면 문구는 호출 쪽이 필드별 messages 키로 바꾼다 - 원문 영어를 그대로 보여 주지 않는다.
 */
const PROPERTY_MESSAGE = /^([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s+(?:must|should|is|has|contains|does)\b/;

export function validationFieldsFromMessages(messages: readonly string[]): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const message of messages) {
    const match = PROPERTY_MESSAGE.exec(message);
    if (!match) continue;
    const property = match[1];
    // `in` would also see Object.prototype keys, so a property named `constructor` or `toString` would never be recorded.
    if (!Object.hasOwn(fields, property)) fields[property] = message;
  }
  return fields;
}

/** `VALIDATION_FAILED` 오류에서 필드 힌트를 꺼낸다; 다른 오류나 메시지가 없으면 빈 객체 */
export function validationFieldsFromError(error: unknown): Record<string, string> {
  if (!(error instanceof ApiHttpError) || error.code !== "VALIDATION_FAILED") return {};
  return validationFieldsFromMessages(error.details);
}
