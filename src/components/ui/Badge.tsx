import type { ReactNode } from "react";

type BadgeVariant =
  | "primary-soft"
  | "selected"
  | "success"
  | "danger"
  | "warning"
  | "neutral"
  | "inverse";

type BadgeProps = {
  variant?: BadgeVariant;
  children: ReactNode;
};

const variantClasses: Record<BadgeVariant, string> = {
  "primary-soft": "bg-primary-soft text-primary-strong",
  selected: "bg-primary text-primary-soft",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
  neutral: "bg-surface-subtle text-ink-secondary",
  inverse: "bg-on-inverse/12 text-primary-outline",
};

export function Badge({ variant = "primary-soft", children }: BadgeProps) {
  return (
    <span
      className={`inline-flex h-6 w-fit items-center rounded-full px-2.5 py-[3px] text-xs font-semibold ${variantClasses[variant]}`}
    >
      {children}
    </span>
  );
}
