/** BE `AuditService.list` row/page, mapped for the audit-log viewer (GET /admin/audit-logs). */
export type AdminAuditLog = {
  id: string;
  actorUserId: string | null;
  actorAgentId: string | null;
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
  "ADMIN_GRANTED", "ADMIN_REVOKED", "NFT_JOB_REQUEUED", "PAYOUT_CORRECTED_MANUAL", "PAYOUT_CANCELLED_MANUAL",
];

export type AuditActorKind = "user" | "agent" | "script" | "unknown";

export function auditActorKind(log: Pick<AdminAuditLog, "actorUserId" | "actorAgentId" | "action">): AuditActorKind {
  if (log.actorUserId) return "user";
  if (log.actorAgentId) return "agent";
  return OPS_SCRIPT_ACTIONS.includes(log.action) ? "script" : "unknown";
}
