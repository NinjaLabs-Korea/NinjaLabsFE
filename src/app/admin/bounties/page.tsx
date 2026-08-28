import type { Metadata } from "next";
import { BountyManager } from "@/components/admin/BountyManager";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { AdminToastHost } from "@/components/admin/AdminToastHost";
import { getAdminBounties } from "@/lib/admin";
import { loadRuntimeConfig } from "@/lib/runtime/config";

export const metadata: Metadata = {
  title: "Admin · Bounties — Ninja Labs",
  description: "Create and manage sponsor-backed bounties.",
};

export default function AdminBountiesPage() {
  const bounties = loadRuntimeConfig().runtimeMode === "mock" ? getAdminBounties() : [];

  return (
    <section className="mx-auto max-w-content px-6 py-16 pb-20">
      <BountyManager bounties={bounties} tabs={<div className="mt-6"><AdminTabs active="bounties" /></div>}>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">ADMIN</p>
          <h1 className="mt-2 font-display text-5xl -tracking-[0.48px] text-ink">Bounty management</h1>
          <p className="mt-4 max-w-[768px] text-lg text-ink-muted">Create and manage sponsor-backed bounties.</p>
        </div>
      </BountyManager>
      <AdminToastHost />
    </section>
  );
}
