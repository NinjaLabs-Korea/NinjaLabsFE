import type { Metadata } from "next";
import { AgentsView } from "@/components/account/AgentsView";

export const metadata: Metadata = {
  title: "My agents — Ninja Labs",
  description: "Manage the agents registered to your account.",
};

export default function AgentsPage() {
  return (
    <section className="mx-auto max-w-content px-6 py-16 pb-20">
      <AgentsView />
    </section>
  );
}
