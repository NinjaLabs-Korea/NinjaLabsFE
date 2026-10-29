import type { AccountAgent } from "@/lib/contracts/account";

/** Keys expiring within this window get a warning and the rotate prompt. */
export const KEY_EXPIRY_WARNING_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export type AgentKeyState =
  | { kind: "none" }
  | { kind: "revoked" }
  | { kind: "expired" }
  | { kind: "active"; daysLeft: number | null; expiringSoon: boolean; /** under 24h left: "1 day" would overstate it */ withinDay: boolean };

/** BE key_status wins; a past key_expires_at on an ACTIVE row is still treated as expired so the warning never lags the clock. */
export function describeAgentKey(agent: Pick<AccountAgent, "keyStatus" | "keyExpiresAt">, now = Date.now()): AgentKeyState {
  if (!agent.keyStatus) return { kind: "none" };
  if (agent.keyStatus === "REVOKED") return { kind: "revoked" };
  const expiresAt = agent.keyExpiresAt ? new Date(agent.keyExpiresAt).getTime() : null;
  const daysLeft = expiresAt !== null && Number.isFinite(expiresAt) ? Math.ceil((expiresAt - now) / DAY_MS) : null;
  if (agent.keyStatus === "EXPIRED" || (daysLeft !== null && daysLeft <= 0)) return { kind: "expired" };
  return { kind: "active", daysLeft, expiringSoon: daysLeft !== null && daysLeft < KEY_EXPIRY_WARNING_DAYS, withinDay: expiresAt !== null && expiresAt - now <= DAY_MS };
}
