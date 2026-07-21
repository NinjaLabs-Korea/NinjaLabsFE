type ToastVariant = "success" | "danger" | "warning" | "info";

type ToastProps = {
  variant: ToastVariant;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
};

const variantClasses: Record<ToastVariant, { accent: string; icon: string; symbol: string }> = {
  success: {
    accent: "border-l-success",
    icon: "bg-success-soft text-success",
    symbol: "✓",
  },
  danger: {
    accent: "border-l-danger",
    icon: "bg-danger-soft text-danger",
    symbol: "!",
  },
  warning: {
    accent: "border-l-warning",
    icon: "bg-warning-soft text-warning",
    symbol: "!",
  },
  info: {
    accent: "border-l-primary",
    icon: "bg-primary-soft text-primary-strong",
    symbol: "i",
  },
};

export function Toast({
  variant,
  title,
  description,
  actionLabel,
  onAction,
  onDismiss,
}: ToastProps) {
  const styles = variantClasses[variant];

  return (
    <div
      role={variant === "danger" ? "alert" : "status"}
      className={`flex w-[340px] items-start gap-3 rounded-tile border border-border border-l-[3px] bg-surface px-4 py-3.5 shadow-frame ${styles.accent}`}
    >
      <span
        aria-hidden="true"
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold ${styles.icon}`}
      >
        {styles.symbol}
      </span>
      <div className="flex-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        {description ? <p className="mt-0.5 text-sm text-ink-muted">{description}</p> : null}
        {actionLabel && onAction ? (
          <button
            type="button"
            className="mt-1.5 text-sm font-semibold text-primary-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            onClick={onAction}
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        className="text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        onClick={onDismiss}
      >
        ✕
      </button>
    </div>
  );
}
