import type { ReactNode } from "react";

/** The dashed tile the recruitment page shows for every state without a form (no cohort, closed, sign-in needed ...). */
export function RecruitNotice({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <div className="rounded-tile border border-dashed border-border-dashed bg-surface-subtle p-8 text-center sm:p-10" role="status">
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="mt-1 text-sm text-ink-muted">{body}</p>
      {children ? <div className="mt-4 flex flex-wrap items-center justify-center gap-3">{children}</div> : null}
    </div>
  );
}
