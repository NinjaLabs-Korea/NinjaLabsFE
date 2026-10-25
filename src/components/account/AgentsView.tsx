"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useRef, useState } from "react";
import { SignedOutPanel } from "@/components/account/SignedOutPanel";
import { useAccountQuery } from "@/components/account/useAccountQuery";
import { ApiKeyReveal } from "@/components/agents/ApiKeyReveal";
import {
  useAuthSnapshot,
  useAccountApi,
  useAgentApi,
  useFoundationMode,
} from "@/components/auth/FoundationProvider";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { describeAgentKey } from "@/lib/agent-keys";
import { ERROR_COPY, errorCopyKey } from "@/lib/api/error-copy";
import type { AccountAgent } from "@/lib/contracts/account";
import type { AgentKeyRotation } from "@/lib/contracts/api";

const focusClass =
  "hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const outlineButtonClass = `rounded-control border border-primary-outline px-4 py-2 text-sm font-semibold text-primary-strong disabled:opacity-60 ${focusClass}`;
const dangerButtonClass = `rounded-control border border-danger-soft bg-danger-soft px-4 py-2 text-sm font-semibold text-danger disabled:opacity-60 ${focusClass}`;

/** Per-agent action state: a request on one agent never disables or reports on another. */
type AgentAction =
  | { kind: "rotating" }
  | { kind: "revoking" }
  | { kind: "error"; message: string };

export function AgentsView() {
  const t = useTranslations("agents.list");
  const tRotateErrors = useTranslations(ERROR_COPY.agentRotate.messages);
  const tAccount = useTranslations("account.common");
  const format = useFormatter();
  const mode = useFoundationMode();
  const authSnapshot = useAuthSnapshot();
  const apiClient = useAccountApi();
  const agentApi = useAgentApi();
  const { data: agents, unavailable, reason, refresh } = useAccountQuery(apiClient.getAgents);
  const [actions, setActions] = useState<Record<string, AgentAction | undefined>>({});
  // Synchronous guard against double submits: state updates land after the second click would have fired.
  const pendingRef = useRef(new Set<string>());
  // Rotated keys are shown once, per agent (a second rotation must not hide the first one-time key);
  // they live only in this render tree and are dropped on navigation.
  const [rotations, setRotations] = useState<Record<string, AgentKeyRotation | undefined>>({});
  // ...and only for the session that rotated them: a sign-out or account switch on this page drops every revealed key.
  const sessionUserId = authSnapshot.status === "signed-in" ? authSnapshot.user.id : null;
  const [rotationsOwner, setRotationsOwner] = useState(sessionUserId);
  if (rotationsOwner !== sessionUserId) {
    setRotationsOwner(sessionUserId);
    setRotations({});
  }
  const setRotation = (agentId: string, rotation: AgentKeyRotation | null) =>
    setRotations((current) => {
      const next = { ...current };
      if (rotation) next[agentId] = rotation;
      else delete next[agentId];
      return next;
    });
  const [revokeTarget, setRevokeTarget] = useState<AccountAgent | null>(null);
  // After a confirmed revoke the opener button disappears, so the dialog hands focus to that card's heading.
  const headingRefs = useRef(new Map<string, HTMLHeadingElement>());
  const lastRevokeIdRef = useRef<string | null>(null);
  const focusRevokedHeading = useCallback(
    () => (lastRevokeIdRef.current ? headingRefs.current.get(lastRevokeIdRef.current) : null),
    [],
  );
  const setAgentAction = (agentId: string, action: AgentAction | null) =>
    setActions((current) => {
      const next = { ...current };
      if (action) next[agentId] = action;
      else delete next[agentId];
      return next;
    });

  // The BE rejected the session (401/403 after refresh): ask to sign in again instead of blaming the server.
  if (unavailable && reason === "unauthorized") {
    return <SignedOutPanel message={tAccount("sessionExpired")} />;
  }

  if (unavailable) {
    return (
      <div className="rounded-tile border border-dashed border-border-dashed bg-surface-subtle p-10 text-center">
        <p className="text-sm font-semibold text-ink">{t("unavailableTitle")}</p>
        <p className="mt-1 text-sm text-ink-muted">{tAccount("unavailableBody")}</p>
      </div>
    );
  }

  if (authSnapshot.status === "signed-out") {
    return <SignedOutPanel message={t("signedOutMessage")} />;
  }

  if (authSnapshot.status === "loading" || !agents) {
    return <p className="text-sm text-ink-muted" role="status">{tAccount("loading")}</p>;
  }

  if (agents.length === 0) {
    return (
      <div className="rounded-tile border border-dashed border-border-dashed bg-surface-subtle p-10 text-center">
        <p className="text-sm font-semibold text-ink">{t("emptyTitle")}</p>
        <p className="mt-1 text-sm text-ink-muted">{t("emptyBody")}</p>
      </div>
    );
  }

  const rotateKey = async (agent: AccountAgent) => {
    if (pendingRef.current.has(agent.id)) return;
    pendingRef.current.add(agent.id);
    setAgentAction(agent.id, { kind: "rotating" });
    setRotation(agent.id, null);
    try {
      setRotation(agent.id, await agentApi.rotateAgentKey(agent.id));
      setAgentAction(agent.id, null);
      refresh();
    } catch (error) {
      setAgentAction(agent.id, { kind: "error", message: tRotateErrors(errorCopyKey(error, ERROR_COPY.agentRotate)) });
    } finally {
      pendingRef.current.delete(agent.id);
    }
  };

  const revokeAgent = async (agent: AccountAgent) => {
    setRevokeTarget(null);
    if (pendingRef.current.has(agent.id)) return;
    pendingRef.current.add(agent.id);
    lastRevokeIdRef.current = agent.id;
    setAgentAction(agent.id, { kind: "revoking" });
    setRotation(agent.id, null);
    try {
      await agentApi.revokeAgent(agent.id);
      setAgentAction(agent.id, null);
      refresh();
    } catch {
      setAgentAction(agent.id, { kind: "error", message: t("revokeFailed") });
    } finally {
      pendingRef.current.delete(agent.id);
    }
  };

  const formatDate = (value: string) => format.dateTime(new Date(value), { dateStyle: "medium", timeStyle: "short" });

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2">
        {agents.map((agent) => {
          const revoked = agent.status === "REVOKED";
          const key = describeAgentKey(agent);
          const action = actions[agent.id];
          const rotation = rotations[agent.id];
          const busy = action?.kind === "rotating" || action?.kind === "revoking";
          const errorMessage = action?.kind === "error" ? action.message : null;
          const keyStatusLabel = t(`keyStatus.${key.kind}`);
          const keyWarning = revoked
            ? null
            : key.kind === "expired"
              ? t("keyExpired")
              : key.kind === "active" && key.expiringSoon && key.daysLeft !== null
                ? t("keyExpiringSoon", { days: key.daysLeft })
                : null;

          return (
            <article className={`rounded-card border border-dashed border-border bg-surface p-5${revoked ? " opacity-70" : ""}`} key={agent.id}>
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  className="font-display text-lg font-bold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  ref={(element) => {
                    if (element) headingRefs.current.set(agent.id, element);
                    else headingRefs.current.delete(agent.id);
                  }}
                  tabIndex={-1}
                >
                  {agent.name}
                </h2>
                {revoked ? (
                  <Badge variant="danger">{t("revoked")}</Badge>
                ) : agent.verified ? (
                  <Badge variant="success">{t("verified")}</Badge>
                ) : (
                  <Badge variant="neutral">{t("unverified")}</Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-ink-muted">{agent.walletAddress}</p>

              <dl className="mt-3 space-y-1.5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <dt className="font-semibold text-ink">{t("apiKey")}</dt>
                  <dd className="text-ink-secondary">{agent.apiKeyMasked}</dd>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <dt className="font-semibold text-ink">{t("keyStatusLabel")}</dt>
                  <dd className="flex flex-wrap items-center gap-2 text-ink-secondary">
                    <Badge variant={key.kind === "active" ? (key.expiringSoon ? "warning" : "success") : key.kind === "none" ? "neutral" : "danger"}>
                      {keyStatusLabel}
                    </Badge>
                    {agent.keyExpiresAt && key.kind !== "revoked" ? <span>{t("keyExpires", { date: formatDate(agent.keyExpiresAt) })}</span> : null}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="font-semibold text-ink">{t("registered")}</dt>
                  <dd className="text-ink-secondary">{format.dateTime(new Date(agent.registeredAt), { dateStyle: "medium" })}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="font-semibold text-ink">{t("completedBounties")}</dt>
                  <dd className="text-ink-secondary">{agent.completedBounties}</dd>
                </div>
              </dl>

              {keyWarning ? <p className="mt-3 text-sm text-warning" role="status">{keyWarning}</p> : null}
              {revoked ? <p className="mt-3 text-sm text-ink-muted">{t("revokedNote")}</p> : null}

              {!revoked ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className={outlineButtonClass} disabled={busy || !agent.verified} onClick={() => void rotateKey(agent)} type="button">
                    {action?.kind === "rotating" ? t("rotating") : t("rotateKey")}
                  </button>
                  <button className={dangerButtonClass} disabled={busy} onClick={() => setRevokeTarget(agent)} type="button">
                    {action?.kind === "revoking" ? t("revoking") : t("revokeAgent")}
                  </button>
                </div>
              ) : null}
              {errorMessage ? <p className="mt-3 text-sm text-danger" role="alert">{errorMessage}</p> : null}

              {rotation ? (
                <ApiKeyReveal
                  apiKey={rotation.apiKey}
                  className="mt-4"
                  copy={t("rotatedCopy")}
                  expiresLabel={t("keyExpires", { date: formatDate(rotation.expiresAt) })}
                  title={t("rotatedHeading")}
                />
              ) : null}
            </article>
          );
        })}
      </div>

      {mode === "mock" ? (
        <p className="mt-3 text-xs text-ink-muted">{tAccount("mockNote")}</p>
      ) : null}

      <ConfirmDialog
        calloutText={t("revokeDialog.callout")}
        confirmLabel={t("revokeDialog.confirm")}
        description={t("revokeDialog.description")}
        destructive
        eyebrow={t("revokeDialog.eyebrow")}
        onCancel={() => setRevokeTarget(null)}
        onConfirm={() => { if (revokeTarget) void revokeAgent(revokeTarget); }}
        open={revokeTarget !== null}
        returnFocusTo={focusRevokedHeading}
        title={t("revokeDialog.title", { name: revokeTarget?.name ?? "" })}
      />
    </>
  );
}
