import type { Metadata } from "next";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { AdminToastHost } from "@/components/admin/AdminToastHost";
import { UserDirectory } from "@/components/admin/UserDirectory";
import { Badge } from "@/components/ui/Badge";
import { getAdminUsers } from "@/lib/admin";
export const metadata: Metadata = {
  title: "Admin · Users — Ninja Labs",
  description: "Manage user access, wallet connections, and member roles.",
};

export default function AdminUsersPage() {
  const users = getAdminUsers();

  return (
    <section className="mx-auto max-w-content px-6 py-16 pb-20">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">ADMIN</p>
          <h1 className="mt-2 font-display text-5xl -tracking-[0.48px] text-ink">User management</h1>
          <p className="mt-4 max-w-[768px] text-lg text-ink-muted">Manage user access, wallet connections, and member roles.</p>
        </div>
        <Badge variant="neutral">ADMIN ONLY</Badge>
      </div>

      <div className="mt-6">
        <AdminTabs active="users" />
      </div>

      <UserDirectory users={users} />
      <AdminToastHost />

    </section>
  );
}
