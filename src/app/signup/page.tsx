import type { Metadata } from "next";

import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";
import { Badge } from "@/components/ui/Badge";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { signup } from "@/lib/signup";
import { loadRuntimeConfig } from "@/lib/runtime/config";

export function generateMetadata(): Metadata {
  const login = signup.login[loadRuntimeConfig().runtimeMode];

  return {
    title: `${login.title} — Ninja Labs`,
    description: login.description,
  };
}

export default function SignupPage() {
  const login = signup.login[loadRuntimeConfig().runtimeMode];
  return (
    <section className="mx-auto max-w-content px-6 py-16 pb-20">
      <div className="mx-auto max-w-[768px]">
        <div className="flex justify-end">
          <Badge variant="danger">{login.badge}</Badge>
        </div>
        <div className="mt-8">
          <StepIndicator current={1} />
        </div>
        <div className="mx-auto mt-6 max-w-[576px] rounded-card border border-border bg-surface p-5 shadow-card sm:p-[21px]">
          <h1 className="font-display text-4xl -tracking-[0.36px] text-ink">{login.title}</h1>
          <p className="mt-3 text-base text-ink-muted">{login.description}</p>
          <GoogleLoginButton />
          <div className="mt-5 rounded-tile border border-border bg-primary-soft p-4 text-sm text-ink-notice">
            {login.disclosure}
          </div>
        </div>
        <div className="mx-auto mt-5 max-w-[576px] rounded-card border border-border bg-surface p-5 shadow-card sm:p-[21px]">
          <h2 className="font-display text-lg font-bold text-ink">{login.statusTitle}</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink-muted">
            {login.edgeCases.map((edgeCase) => (
              <li key={edgeCase}>{edgeCase}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
