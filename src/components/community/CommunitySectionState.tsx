"use client";

import type { ReactNode } from "react";

import { Link, useRouter } from "@/i18n/navigation";

const actionClass = "mt-4 inline-block text-sm font-semibold text-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/**
 * The empty / unavailable box every community section shares (same dashed tile as the landing bounty preview). An empty box
 * offers a next step (`action`: a link); an unavailable box offers `retryLabel`, which re-reads the page (`router.refresh()`).
 * Labels come in as props so this client component needs no message namespace.
 */
export function CommunitySectionState({ title, body, action, retryLabel }: { title?: string; body: ReactNode; action?: { label: string; href: string }; retryLabel?: string }) {
  const router = useRouter();
  return (
    <div className="mt-7 rounded-tile border border-dashed border-border-dashed bg-surface-subtle p-10 text-center" role="status">
      {title ? <p className="text-sm font-semibold text-ink">{title}</p> : null}
      <p className={`${title ? "mt-1 " : ""}text-sm text-ink-muted`}>{body}</p>
      {action ? <Link className={actionClass} href={action.href}>{action.label}</Link> : null}
      {retryLabel ? <button className={actionClass} onClick={() => router.refresh()} type="button">{retryLabel}</button> : null}
    </div>
  );
}
