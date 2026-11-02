import { BE_AUDIT_ACTIONS, BE_SCRIPT_AUDIT_ACTIONS } from "@/lib/api/be-audit-actions";

/** BE `AuditService.list` row/page, mapped for the audit-log viewer (GET /admin/audit-logs). */
export type AdminAuditLog = {
  id: string;
  actorUserId: string | null;
  actorAgentId: string | null;
  /** Nickname of `actorUserId` (BE `actor_nickname`); null/absent when there is no user actor or the account has no nickname. */
  actorNickname?: string | null;
  /** Name of `actorAgentId` (BE `actor_agent_name`); null/absent when there is no agent actor. */
  actorAgentName?: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  /** BE `before_data` / `after_data` (jsonb). Only rows written with a `change` carry them; most rows have neither. */
  beforeData?: unknown;
  afterData?: unknown;
};

export type AdminAuditLogPage = { items: AdminAuditLog[]; page: number; pageSize: number; total: number };

export type AdminAuditLogFilter = { entityType?: string; entityId?: string };

/** Mirror of the BE `AuditLogsQueryDto.entityId` `@IsUUID()`. */
const AUDIT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isAuditUuid = (value: string): boolean => AUDIT_UUID.test(value.trim());

/**
 * Actions written by ops scripts / manual SQL (BE `docs/api-contract.md`): these rows have no actor on purpose.
 * A missing actor alone is not enough (an agent's `APPLICATION_REAPPLIED` row has none either).
 */
const OPS_SCRIPT_ACTIONS: readonly string[] = [
  "ADMIN_GRANTED", "ADMIN_REVOKED", "NFT_JOB_REQUEUED", "REWARD_REFUNDED", "PAYOUT_CORRECTED_MANUAL", "PAYOUT_CANCELLED_MANUAL",
];

/**
 * Script actions that DO carry an actor (`scripts/forfeit-award.js --admin <id>` records the deciding operator). The action name alone
 * says "ops script"; the actor id is still shown next to the badge.
 */
const OPS_SCRIPT_ACTIONS_WITH_ACTOR: readonly string[] = ["SUBMISSION_AWARD_FORFEITED"];

export type AuditActorKind = "user" | "agent" | "script" | "unknown";

export function auditActorKind(log: Pick<AdminAuditLog, "actorUserId" | "actorAgentId" | "action">): AuditActorKind {
  if (OPS_SCRIPT_ACTIONS_WITH_ACTOR.includes(log.action)) return "script";
  if (log.actorUserId) return "user";
  if (log.actorAgentId) return "agent";
  return OPS_SCRIPT_ACTIONS.includes(log.action) ? "script" : "unknown";
}

/**
 * Every audit `action` the viewer has a translated label for (`admin.audit.actions.<code>` in all three locales): the BE catalog
 * snapshot (`lib/api/be-audit-actions.ts`, server actions + ops-script actions). An action not listed here still renders (its raw
 * code is shown). `src/test/admin-audit-labels.test.ts` fails when the three `admin.json` label sets and this list drift apart.
 */
export const KNOWN_AUDIT_ACTIONS: readonly string[] = [...BE_AUDIT_ACTIONS, ...BE_SCRIPT_AUDIT_ACTIONS];

/** One changed field of an audit row: `before`/`after` are display strings, `null` when the side has no value for that key. */
export type AuditFieldChange = { key: string; before: string | null; after: string | null; hidden: boolean };

/**
 * Keys whose values are never rendered. The BE promises not to store secrets in `before_data`/`after_data` (`AuditChange` doc,
 * migration 0009), so this is a second belt: if a future caller slips one in, an operator screen still does not show it.
 */
const SECRET_KEY = /token|secret|password|passwd|api[_-]?key|private[_-]?key|authorization|cookie|credential/i;
const VALUE_MAX = 300;

const isPlainObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

function displayValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > VALUE_MAX ? `${text.slice(0, VALUE_MAX)}…` : text;
}

/**
 * Fields that differ between `before` and `after`, in first-seen key order (before's keys, then new keys of after). A key that is
 * equal on both sides is dropped: the operator wants what changed, not the whole snapshot. A side that is not a JSON object (a bare
 * value) is shown under the key `value`. Both sides empty -> empty list.
 */
export function auditChanges(before: unknown, after: unknown): AuditFieldChange[] {
  const side = (value: unknown): Record<string, unknown> => (isPlainObject(value) ? value : value === undefined || value === null ? {} : { value });
  const b = side(before);
  const a = side(after);
  const keys = [...Object.keys(b), ...Object.keys(a).filter((key) => !(key in b))];
  const changes: AuditFieldChange[] = [];
  for (const key of keys) {
    if (JSON.stringify(b[key] ?? null) === JSON.stringify(a[key] ?? null)) continue;
    const hidden = SECRET_KEY.test(key);
    changes.push({ key, before: hidden ? null : displayValue(b[key]), after: hidden ? null : displayValue(a[key]), hidden });
  }
  return changes;
}

/** True when the row carries any before/after payload at all (an empty `{}` counts as none). */
export function hasAuditData(log: Pick<AdminAuditLog, "beforeData" | "afterData">): boolean {
  const filled = (value: unknown) => value !== undefined && value !== null && !(isPlainObject(value) && Object.keys(value).length === 0);
  return filled(log.beforeData) || filled(log.afterData);
}
