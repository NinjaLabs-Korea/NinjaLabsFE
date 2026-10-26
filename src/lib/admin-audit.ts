/** BE `AuditService.list` row/page, mapped for the audit-log viewer (GET /admin/audit-logs). */
export type AdminAuditLog = {
  id: string;
  actorUserId: string | null;
  actorAgentId: string | null;
  /** Nickname of `actorUserId` (BE `actor_nickname`); null/absent when there is no user actor or the account has no nickname. */
  actorNickname?: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
};

export type AdminAuditLogPage = { items: AdminAuditLog[]; page: number; pageSize: number; total: number };

export type AdminAuditLogFilter = { entityType?: string; entityId?: string };

/** Mirror of the BE `AuditLogsQueryDto.entityId` `@IsUUID()`. */
export const AUDIT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isAuditUuid = (value: string): boolean => AUDIT_UUID.test(value.trim());
/** BE `@MaxLength(64)` on `entityType`. */
export const AUDIT_ENTITY_TYPE_MAX = 64;

/**
 * Actions written by ops scripts / manual SQL (BE `docs/api-contract.md`): these rows have no actor on purpose.
 * A missing actor alone is not enough (an agent's `APPLICATION_REAPPLIED` row has none either).
 */
export const OPS_SCRIPT_ACTIONS: readonly string[] = [
  "ADMIN_GRANTED", "ADMIN_REVOKED", "NFT_JOB_REQUEUED", "REWARD_REFUNDED", "PAYOUT_CORRECTED_MANUAL", "PAYOUT_CANCELLED_MANUAL",
];

/**
 * Script actions that DO carry an actor (`scripts/forfeit-award.js --admin <id>` records the deciding operator). The action name alone
 * says "ops script"; the actor id is still shown next to the badge.
 */
export const OPS_SCRIPT_ACTIONS_WITH_ACTOR: readonly string[] = ["SUBMISSION_AWARD_FORFEITED"];

export type AuditActorKind = "user" | "agent" | "script" | "unknown";

export function auditActorKind(log: Pick<AdminAuditLog, "actorUserId" | "actorAgentId" | "action">): AuditActorKind {
  if (OPS_SCRIPT_ACTIONS_WITH_ACTOR.includes(log.action)) return "script";
  if (log.actorUserId) return "user";
  if (log.actorAgentId) return "agent";
  return OPS_SCRIPT_ACTIONS.includes(log.action) ? "script" : "unknown";
}
