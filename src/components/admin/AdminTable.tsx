import type { ReactNode } from "react";

/**
 * Long free text in a cell (titles, messages, emails, URLs, error text): `anywhere` lets an unbroken run wrap AND lowers
 * the cell's min-content width, so one long value cannot stretch the whole table or squeeze the action column. Use it on
 * text cells only: on a short value (date, badge) it would let the table algorithm squeeze that column to one character.
 */
export const adminLongTextCell = "[overflow-wrap:anywhere]";

/** The row-action column id (`edit`/`delete`/`approve` buttons): it never shrinks below its buttons. */
const ACTION_COLUMN_ID = "action";

type AdminTableProps = {
  columns: { id: string; label: string; widthClass?: string }[];
  minWidthClass: string;
  /** When set, each header gets the id `${idPrefix}-${column.id}` so a cell can point at it with `aria-labelledby`. */
  idPrefix?: string;
  children: ReactNode;
};

/**
 * Long free text in a table cell (application message up to 3000 chars, submission description up to 8000): a bounded scroll box
 * (about 10 lines) so one row cannot grow thousands of pixels tall. Keyboard focusable so the overflow scrolls without a mouse;
 * short text fits and shows no scrollbar. `labelledBy` is the column header id (see `AdminTable.idPrefix`), so no new copy.
 */
export function AdminLongText({ labelledBy, children }: { labelledBy: string; children: ReactNode }) {
  return (
    <div
      aria-labelledby={labelledBy}
      className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      role="region"
      tabIndex={0}
    >
      {children}
    </div>
  );
}

/**
 * Admin list table in a horizontal scroll container (phones scroll the table, they never reflow the page). Buttons and
 * button-styled links in a cell, and column headers, never wrap (a Korean "수정" is 2 characters: wrapping it gives one
 * syllable per line); the action column keeps a min width that fits two buttons side by side.
 */
export function AdminTable({ columns, minWidthClass, idPrefix, children }: AdminTableProps) {
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface shadow-card">
      <table className={`w-full ${minWidthClass} [&_td_button]:whitespace-nowrap [&_td_a.rounded-control]:whitespace-nowrap`}>
        <thead>
          <tr className="bg-primary-soft">
            {columns.map((column) => (
              <th
                className={`whitespace-nowrap px-5 py-4 text-left text-sm font-semibold text-ink-notice ${column.id === ACTION_COLUMN_ID ? "min-w-[11.5rem]" : ""} ${column.widthClass ?? ""}`}
                id={idPrefix ? `${idPrefix}-${column.id}` : undefined}
                key={column.id}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
