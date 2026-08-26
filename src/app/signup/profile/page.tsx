import type { Metadata } from "next";
import { ProfileForm } from "@/components/signup/ProfileForm";
import { Badge } from "@/components/ui/Badge";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { signup } from "@/lib/signup";

export const metadata: Metadata = {
  title: "Set up profile — Ninja Labs",
  description: "Spam control and profile quality",
};

export default function SignupProfilePage() {
  return (
    <section className="mx-auto max-w-content px-6 py-16 pb-20">
      <div className="mx-auto max-w-[1024px]">
        <div className="flex justify-end">
          <Badge variant="danger">{signup.badges.profile}</Badge>
        </div>
        <div className="mt-8">
          <StepIndicator current={3} />
        </div>
        <div className="mt-6 grid gap-5 lg:grid-cols-5">
          <section className="rounded-card border border-border bg-surface p-5 shadow-card sm:p-[21px] lg:col-span-3">
            <h1 className="font-display text-4xl -tracking-[0.36px] text-ink">{signup.profile.title}</h1>
            <ProfileForm />
          </section>
          <aside className="rounded-card border border-border bg-surface p-5 shadow-card sm:p-[21px] lg:col-span-2">
            <h2 className="font-display text-2xl -tracking-[0.24px] text-ink">Why all required</h2>
            <h3 className="mt-4 text-base font-semibold text-ink">Spam control and profile quality</h3>
            <ul className="mt-3 list-disc space-y-3 pl-5 text-sm text-ink-muted">
              {signup.profile.requirements.map((requirement) => (
                <li key={requirement}>{requirement}</li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
    </section>
  );
}
