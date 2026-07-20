import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { signup } from "@/lib/signup";

export const metadata: Metadata = {
  title: "Sign up — Ninja Labs",
  description: "Create your Ninja Labs account with Google.",
};

export default function SignupPage() {
  return (
    <section className="mx-auto max-w-content px-6 py-16 pb-20">
      <div className="mx-auto max-w-[768px]">
        <div className="flex justify-end">
          <Badge variant="danger">{signup.badges.login}</Badge>
        </div>
        <div className="mt-8">
          <StepIndicator current={1} />
        </div>
        <div className="mx-auto mt-6 max-w-[576px] rounded-card border border-border bg-surface p-5 shadow-card sm:p-[21px]">
          <h1 className="font-display text-4xl -tracking-[0.36px] text-ink">{signup.login.title}</h1>
          <p className="mt-3 text-base text-ink-muted">{signup.login.description}</p>
          <Link
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-control bg-primary px-5 py-3 text-base font-semibold text-on-inverse hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            href="/signup/wallet"
          >
            <span className="text-base font-bold">G</span>
            Continue with Google
          </Link>
          <div className="mt-5 rounded-tile border border-border bg-primary-soft p-4 text-sm text-ink-notice">
            {signup.login.turnstile}
          </div>
        </div>
        <div className="mx-auto mt-5 max-w-[576px] rounded-card border border-border bg-surface p-5 shadow-card sm:p-[21px]">
          <h2 className="font-display text-lg font-bold text-ink">Sign-in edge cases</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink-muted">
            {signup.login.edgeCases.map((edgeCase) => (
              <li key={edgeCase}>{edgeCase}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
