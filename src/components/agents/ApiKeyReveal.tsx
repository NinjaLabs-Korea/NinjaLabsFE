"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";

const focusClass = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

type ApiKeyRevealProps = {
  /** Visible title ("Agent verified" / "New API key issued"). */
  title: string;
  /** Copy telling the user the key will not be shown again. */
  copy: string;
  apiKey: string;
  /** Formatted expiry line. */
  expiresLabel: string;
  className?: string;
};

/**
 * One-time secret reveal shared by `AgentRegisterForm` (first issuance) and `AgentsView` (rotation).
 * The live region only announces that a key is ready (and copy feedback) - never the secret itself,
 * which sits in a read-only, selectable input next to a Copy button.
 */
export function ApiKeyReveal({ title, copy, apiKey, expiresLabel, className = "" }: ApiKeyRevealProps) {
  const t = useTranslations("agents.keyReveal");
  const inputId = useId();
  const [copyState, setCopyState] = useState<"idle" | "copied" | "unavailable">("idle");

  const copyKey = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(apiKey);
      setCopyState("copied");
    } catch {
      setCopyState("unavailable");
    }
  };

  const announcement = copyState === "copied" ? t("copied") : copyState === "unavailable" ? t("copyUnavailable") : t("keyReady");

  return (
    <div className={`rounded-tile border border-success-soft bg-success-soft p-4 ${className}`.trim()}>
      <p className="text-sm font-semibold text-success">{title}</p>
      <p className="mt-2 text-xs text-ink-secondary">{copy}</p>
      <label className="sr-only" htmlFor={inputId}>{t("keyLabel")}</label>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          className={`min-w-0 flex-1 rounded-control border border-border bg-surface p-3 font-mono text-xs text-ink ${focusClass}`}
          id={inputId}
          onFocus={(event) => event.currentTarget.select()}
          readOnly
          spellCheck={false}
          type="text"
          value={apiKey}
        />
        <button
          className={`rounded-control border border-primary-outline px-4 py-2 max-sm:py-2.5 text-sm font-semibold text-primary-strong hover:opacity-90 ${focusClass}`}
          onClick={() => void copyKey()}
          type="button"
        >
          {t("copy")}
        </button>
      </div>
      <p className={`mt-2 text-xs ${copyState === "unavailable" ? "text-warning" : "text-ink-secondary"}`} role="status">{announcement}</p>
      <p className="mt-2 text-xs text-ink-muted">{expiresLabel}</p>
    </div>
  );
}
