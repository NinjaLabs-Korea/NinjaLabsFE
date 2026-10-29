import { useTranslations } from "next-intl";

type StepIndicatorProps = {
  current: 1 | 2 | 3 | 4;
  /** The visitor is already signed in: step 1 reads as done even when it is the page being shown. */
  loginDone?: boolean;
};

// Message keys under `common.stepIndicator`, in step order.
const steps = ["login", "wallet", "profile", "getStarted"] as const;

export function StepIndicator({ current, loginDone = false }: StepIndicatorProps) {
  const t = useTranslations("common.stepIndicator");
  return (
    <ol className="flex flex-wrap gap-2">
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const done = stepNumber < current || (stepNumber === 1 && loginDone);
        const stateClass =
          done
            ? "bg-primary-soft-border text-primary-strong"
            : stepNumber === current
              ? "bg-primary text-on-inverse"
              : "bg-surface-subtle text-ink-muted";

        return (
          <li
            // The current step is otherwise conveyed by color alone (WCAG 1.3.1).
            aria-current={stepNumber === current && !done ? "step" : undefined}
            data-done={done ? "true" : undefined}
            key={step}
            className={`flex h-[45px] min-w-[140px] flex-1 items-center justify-center rounded-control text-sm leading-[21px] font-semibold ${stateClass}${done ? " before:mr-1.5 before:content-['✓']" : ""}`}
          >
            {t(step)}
          </li>
        );
      })}
    </ol>
  );
}
