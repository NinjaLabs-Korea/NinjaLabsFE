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
      className={`inline-flex min-h-6 w-fit max-w-full items-center whitespace-nowrap rounded-full px-2.5 py-[3px] text-xs font-semibold ${variantClasses[variant]}`}
    >
      <span className="min-w-0 truncate [&_img]:inline [&_img]:shrink-0 [&_img]:align-middle [&_svg]:inline [&_svg]:shrink-0 [&_svg]:align-middle">{children}</span>
    </span>
  );
}
