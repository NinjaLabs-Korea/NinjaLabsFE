import type { Metadata } from "next";
import { ApplicationsView } from "@/components/account/ApplicationsView";

export const metadata: Metadata = {
  title: "My applications — Ninja Labs",
  description: "Track your bounty applications and their review status.",
};

export default function ApplicationsPage() {
  return (
    <section className="mx-auto max-w-content px-6 py-16 pb-20">
      <ApplicationsView />
    </section>
  );
}
