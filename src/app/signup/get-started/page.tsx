import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { signup } from "@/lib/signup";

export const metadata: Metadata = {
  title: "Get started — Ninja Labs",
  description: "All skippable and revisitable from main navigation.",
};

export default function SignupGetStartedPage() {
  return (
    <section className="mx-auto max-w-content px-6 py-16 pb-20">
      <div className="mx-auto max-w-[896px]">
        <div className="flex justify-end">
          <Badge variant="danger">{signup.badges.completion}</Badge>
        </div>
        <div className="mt-8">
          <StepIndicator current={4} />
        </div>
        <section className="mt-6 rounded-card border border-border bg-surface p-5 shadow-card sm:p-[21px]">
          <p className="text-xs font-bold tracking-[0.96px] text-success">ONBOARDING COMPLETE</p>
          <h1 className="mt-3 font-display text-4xl -tracking-[0.36px] text-ink">{signup.completion.title}</h1>
          <p className="mt-3 text-base text-ink-muted">{signup.completion.subtitle}</p>
          <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {signup.completion.actions.map((action) => (
              <Link
                className="flex min-h-[230px] flex-col rounded-card border border-border bg-surface p-5 shadow-card hover:shadow-frame focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                href={action.href}
                key={action.title}
              >
                {action.icon === "mascot" ? (
                  <Image
                    alt=""
                    className="h-12 w-12 rounded-logo"
                    height={48}
                    src="/figma/ninja-labs-mascot.svg"
                    width={48}
                  />
                ) : (
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-primary-soft-border text-xl font-semibold text-primary">
                    {action.icon}
                  </span>
                )}
                <h2 className="mt-5 font-display text-[19.8px] leading-7 font-bold -tracking-[0.2px] text-ink">
                  {action.title}
                </h2>
                <p className="mt-2 text-sm text-ink-muted">{action.description}</p>
              </Link>
            ))}
          </div>
          <Link
            className="mt-6 block text-center text-sm font-semibold text-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            href="/"
          >
            Skip and go to main
          </Link>
          <p className="mt-5 text-center text-xs text-ink-muted">{signup.completion.footnote}</p>
        </section>
      </div>
    </section>
  );
}
