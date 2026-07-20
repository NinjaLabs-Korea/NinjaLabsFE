import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { signup } from "@/lib/signup";

const fieldTags = ["Dev", "Design", "Content", "Other"] as const;

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
            <div className="mt-6 space-y-5">
              <div>
                <label className="text-sm font-semibold text-ink" htmlFor="nickname">
                  Nickname
                </label>
                <input
                  className="mt-2 w-full rounded-control border border-border bg-surface px-4 py-3 text-sm text-ink-secondary placeholder:text-ink-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  defaultValue={signup.profile.nickname}
                  id="nickname"
                  name="nickname"
                  placeholder="Enter your nickname"
                />
                <p className="mt-2 text-xs text-primary">{signup.profile.availability}</p>
              </div>
              <fieldset>
                <legend className="text-sm font-semibold text-ink">Field tags*</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {fieldTags.map((tag) => (
                    <Badge key={tag} variant={tag === "Dev" || tag === "Design" ? "selected" : "primary-soft"}>
                      {tag}
                    </Badge>
                  ))}
                </div>
              </fieldset>
              <div>
                <label className="text-sm font-semibold text-ink" htmlFor="bio">
                  Bio*
                </label>
                <textarea
                  className="mt-2 min-h-[120px] w-full rounded-control border border-border bg-surface px-4 py-3 text-sm text-ink-secondary placeholder:text-ink-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  defaultValue={signup.profile.bio}
                  id="bio"
                  name="bio"
                  placeholder="Tell the community about yourself"
                />
                <p className="mt-2 text-xs text-ink-muted">Short intro required.</p>
              </div>
              <Link
                className="block w-full rounded-control bg-primary px-5 py-3 text-center text-base font-semibold text-on-inverse hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                href="/signup/get-started"
              >
                Next
              </Link>
            </div>
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
