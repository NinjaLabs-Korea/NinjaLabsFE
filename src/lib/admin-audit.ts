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

/**
 * Every audit `action` the viewer has a translated label for (`admin.audit.actions.<code>` in all three locales).
 * The BE builds several codes dynamically (`BOUNTY_${to}`, `APPLICATION_${decision}`, `SUBMISSION_${decision}`,
 * `COHORT_APPLICATION_${decision}`), so this list spells out every value those templates can produce. An action not listed
 * here still renders (its raw code is shown); add it here and to the three `admin.json` files when the BE starts writing it.
 */
export const KNOWN_AUDIT_ACTIONS: readonly string[] = [
  "ADMIN_GRANTED",
  "ADMIN_REVOKED",
  "AGENT_VERIFIED",
  "AGENT_KEY_ROTATED",
  "AGENT_REVOKED",
  "APPLICATION_APPROVED",
  "APPLICATION_REAPPLIED",
  "BOUNTY_CREATED",
  "BOUNTY_UPDATED",
  "BOUNTY_CANCELLED",
  "BOUNTY_DELETED",
  "COHORT_CREATED",
  "COHORT_UPDATED",
  "COHORT_DELETED",
  "COHORT_APPLICATION_REJECTED",
  "HIGHLIGHT_CREATED",
  "HIGHLIGHT_UPDATED",
  "HIGHLIGHT_DELETED",
  "NFT_JOB_RETRIED",
  "NFT_JOB_REQUEUED",
  "NOTICE_CREATED",
  "NOTICE_UPDATED",
  "NOTICE_PUBLISHED",
  "NOTICE_DELETED",
  "PAYOUT_REQUESTED",
  "PAYOUT_APPROVED",
  "PAYOUT_SELF_APPROVED",
  "PAYOUT_CORRECTED_MANUAL",
  "PAYOUT_CANCELLED_MANUAL",
  "REWARD_DEPOSIT_CONFIRMED",
  "REWARD_REFUNDED",
  "SUBMISSION_AWARD_FORFEITED",
  "USER_MEMBER_GRANTED",
  "USER_MEMBER_REVOKED",
  "USER_NICKNAME_CHANGED",
  "USER_WITHDRAWN",
  "SYSTEM",
  "APPLICATION_REJECTED",
  "BOUNTY_FUNDING_PENDING",
  "BOUNTY_OPEN",
  "BOUNTY_SUBMISSION_CLOSED",
  "BOUNTY_IN_REVIEW",
  "BOUNTY_COMPLETED",
  "SUBMISSION_APPROVE",
  "SUBMISSION_REJECT",
  "SUBMISSION_REQUEST_REVISION",
  "SUBMISSION_START_REVIEW",
  "PAYOUT_PAID",
  "COHORT_OPENED",
  "COHORT_REOPENED",
  "COHORT_CLOSED",
  "COHORT_APPLICATION_SUBMITTED",
  "COHORT_APPLICATION_UPDATED",
  "COHORT_APPLICATION_WITHDRAWN",
  "COHORT_APPLICATION_REAPPLIED",
  "COHORT_APPLICATION_ACCEPTED",
];
