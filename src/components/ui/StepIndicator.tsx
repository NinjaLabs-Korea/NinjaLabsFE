import { useTranslations } from "next-intl";

type StepIndicatorProps = {
  current: 1 | 2 | 3 | 4;
};

// Message keys under `common.stepIndicator`, in step order.
const steps = ["login", "wallet", "profile", "getStarted"] as const;

export function StepIndicator({ current }: StepIndicatorProps) {
  const t = useTranslations("common.stepIndicator");
  return (
    <ol className="flex flex-wrap gap-2">
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const stateClass =
          stepNumber < current
            ? "bg-primary-soft-border text-primary-strong"
            : stepNumber === current
              ? "bg-primary text-on-inverse"
              : "bg-surface-subtle text-ink-muted";

        return (
          <li
            key={step}
            className={`grid h-[45px] min-w-[140px] flex-1 place-items-center rounded-control text-sm leading-[21px] font-semibold ${stateClass}`}
          >
            {t(step)}
          </li>
        );
      })}
    </ol>
  );
}
