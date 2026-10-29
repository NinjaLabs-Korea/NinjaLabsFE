/**
 * 에이전트 등록 폼 규칙 - NinjaLabsBE `RegisterAgentDto`(@Trim @Length(1,100) name, @MaxLength(1000) description)의 거울.
 * 한도 숫자는 `src/lib/input-limits.ts`가 단일 출처다(BE가 바뀌면 거기서 고친다).
 */
import { AGENT_DESCRIPTION_MAX, AGENT_NAME_MAX } from "@/lib/input-limits";
import { hasVisibleText } from "@/lib/visible-text";

export { hasVisibleText };

/** 화면 문구는 messages `agents.form.errors.<field><Reason>` */
export type AgentFieldError = "required" | "tooLong" | "rejected";
export type AgentRegisterErrors = Partial<Record<"name" | "description", AgentFieldError>>;

export function validateAgentRegisterForm(input: { name: string; description: string }): AgentRegisterErrors {
  const errors: AgentRegisterErrors = {};
  const name = input.name.trim();
  if (name.length === 0 || !hasVisibleText(name)) errors.name = "required";
  else if (name.length > AGENT_NAME_MAX) errors.name = "tooLong";
  if (input.description.trim().length > AGENT_DESCRIPTION_MAX) errors.description = "tooLong";
  return errors;
}

/** BE `VALIDATION_FAILED` 필드 힌트(`lib/api/validation.ts`) → 이 폼의 필드 에러. 로컬 규칙으로 사유를 다시 판정하고, 통과하면 `rejected`. */
export function agentErrorsFromValidationFields(fields: Record<string, string>, input: { name: string; description: string }): AgentRegisterErrors {
  const local = validateAgentRegisterForm(input);
  const errors: AgentRegisterErrors = {};
  if ("name" in fields) errors.name = local.name ?? "rejected";
  if ("description" in fields) errors.description = local.description ?? "rejected";
  return errors;
}
