import type { ReactNode } from "react";

/** The empty / unavailable box every community section shares (same dashed tile as the landing bounty preview). */
export function CommunitySectionState({ title, body }: { title?: string; body: ReactNode }) {
  return (
    <div className="mt-7 rounded-tile border border-dashed border-border-dashed bg-surface-subtle p-10 text-center" role="status">
      {title ? <p className="text-sm font-semibold text-ink">{title}</p> : null}
      <p className={`${title ? "mt-1 " : ""}text-sm text-ink-muted`}>{body}</p>
    </div>
  );
}
