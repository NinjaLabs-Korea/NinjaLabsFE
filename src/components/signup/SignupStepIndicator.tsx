"use client";

import { useAuthSnapshot } from "@/components/auth/FoundationProvider";
import { StepIndicator } from "@/components/ui/StepIndicator";

/** The signup stepper for a page: step 1 "Login" reads as done (and is never offered again) once the visitor is signed in. */
export function SignupStepIndicator({ current }: { current: 1 | 2 | 3 | 4 }) {
  return <StepIndicator current={current} loginDone={useAuthSnapshot().status === "signed-in"} />;
}
