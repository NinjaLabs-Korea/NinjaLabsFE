import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { signup } from "@/lib/signup";

export const metadata: Metadata = {
  title: "Connect wallet — Ninja Labs",
  description: "Connect an Injective wallet to receive your Ninja NFT.",
};

export default function SignupWalletPage() {
  return (
    <section className="mx-auto max-w-content px-6 py-16 pb-20">
      <div className="mx-auto max-w-[1024px]">
        <div className="flex justify-end">
          <Badge variant="danger">{signup.badges.wallet}</Badge>
        </div>
        <div className="mt-8">
          <StepIndicator current={2} />
        </div>
        <div className="mt-6 grid gap-5 lg:grid-cols-5">
          <article className="rounded-card border border-border bg-surface p-5 shadow-card sm:p-[21px] lg:col-span-3">
            <h1 className="font-display text-4xl -tracking-[0.36px] text-ink">{signup.wallet.title}</h1>
            <p className="mt-3 text-base text-ink-muted">{signup.wallet.description}</p>
            <button
              className="mt-5 w-full rounded-control bg-primary px-5 py-3 text-base font-semibold text-on-inverse"
              type="button"
            >
              Connect Wallet
            </button>
            <div className="mt-5 rounded-tile border border-border bg-primary-soft p-4">
              <Badge variant="primary-soft">NFT · CW-721 Nestable</Badge>
              <p className="mt-2 text-sm text-ink-notice">{signup.wallet.notice}</p>
            </div>
            <Link
              className="mt-5 block w-full rounded-control border border-primary-outline px-5 py-3 text-center text-sm font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              href="/signup/profile"
            >
              Connect later
            </Link>
            <p className="mt-4 text-sm text-ink-muted">{signup.wallet.reassurance}</p>
          </article>
          <aside className="rounded-card border border-border bg-surface p-5 shadow-card sm:p-[21px] lg:col-span-2">
            <h2 className="font-display text-2xl -tracking-[0.24px] text-ink">NFT minting (confirmed)</h2>
            <dl className="mt-5 space-y-4">
              {signup.wallet.details.map(([term, detail]) => (
                <div key={term}>
                  <dt className="text-sm font-semibold text-ink">{term}</dt>
                  <dd className="mt-1 text-sm text-ink-muted">{detail}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </div>
    </section>
  );
}
