import type { ReactNode } from "react";

type AdminTableProps = {
  columns: { id: string; label: string; widthClass?: string }[];
  minWidthClass: string;
  children: ReactNode;
};

export function AdminTable({ columns, minWidthClass, children }: AdminTableProps) {
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface shadow-card">
      <table className={`w-full ${minWidthClass}`}>
        <thead>
          <tr className="bg-primary-soft">
            {columns.map((column) => (
              <th
                className={`px-5 py-4 text-left text-sm font-semibold text-ink-notice ${column.widthClass ?? ""}`}
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
