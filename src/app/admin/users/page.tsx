import type { Metadata } from "next";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { Badge } from "@/components/ui/Badge";
import { getAdminUsers } from "@/lib/admin";

const columns = [
  { id: "nickname", label: "Nickname", widthClass: "w-[157px]" },
  { id: "email", label: "Email", widthClass: "w-[286px]" },
  { id: "joined", label: "Joined", widthClass: "w-[125px]" },
  { id: "wallet", label: "Wallet", widthClass: "w-[138px]" },
  { id: "member", label: "Member", widthClass: "w-[140px]" },
  { id: "role", label: "Role", widthClass: "w-[105px]" },
  { id: "action", label: "Action", widthClass: "w-[199px]" },
];

const roles = ["Core", "Dev", "Design", "Ops"];

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

      <div className="mt-6 rounded-card border border-border bg-surface p-[21px] shadow-card">
        <label className="block text-sm font-semibold text-ink" htmlFor="user-search">Search users</label>
        <input
          id="user-search"
          className="mt-2 h-[46px] w-full rounded-control border border-border px-[17px] text-sm text-ink outline-none placeholder:text-ink-placeholder sm:w-[384px]"
          placeholder="Search by email / nickname"
          type="search"
        />
      </div>

      <div className="mt-6">
        <AdminTable columns={columns} minWidthClass="min-w-[820px]">
          {users.map((user) => (
            <tr className="border-t border-border" key={user.slug}>
              <td className="px-5 py-4 text-sm font-semibold text-ink">{user.nickname}</td>
              <td className="px-5 py-4 text-sm text-ink-muted">{user.email}</td>
              <td className="px-5 py-4 text-sm text-ink-secondary">{user.joinedAt}</td>
              <td className="px-5 py-4 text-sm text-ink-secondary">
                {user.walletStatus === "linked" ? <Badge variant="success">Linked</Badge> : "—"}
              </td>
              <td className="px-5 py-4 text-sm text-ink-secondary">
                {user.isMember ? <Badge variant="success">Yes</Badge> : "—"}
              </td>
              <td className="px-5 py-4 text-sm text-ink-secondary">{user.memberRole ?? "—"}</td>
              <td className="px-5 py-4">
                <button className="rounded-control border border-primary-outline px-4 py-2 text-sm font-semibold text-primary-strong" type="button">
                  {user.isMember ? "Remove" : "Assign"}
                </button>
              </td>
            </tr>
          ))}
        </AdminTable>
      </div>

      <section className="mt-6 w-full max-w-[672px] rounded-card border border-border bg-surface p-[21px] shadow-card">
        <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">MEMBER ROLE</p>
        <h2 className="mt-2 font-display text-2xl -tracking-[0.24px] text-ink">Assign member role</h2>
        <div className="mt-5">
          <p className="text-sm font-semibold text-ink">Role</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {roles.map((role) => (
              <span key={role} className={role === "Core" ? "inline-flex h-6 items-center rounded-full bg-primary px-2.5 text-xs font-semibold text-primary-soft" : "inline-flex h-6 items-center rounded-full bg-primary-soft px-2.5 text-xs font-semibold text-primary-strong"}>
                {role}
              </span>
            ))}
          </div>
        </div>
        <label className="mt-5 block text-sm font-semibold text-ink" htmlFor="display-order">Display order</label>
        <input id="display-order" className="mt-2 h-[46px] w-full rounded-control border border-border px-[17px] text-sm text-ink outline-none placeholder:text-ink-placeholder sm:w-[320px]" placeholder="e.g. 1" type="number" />
        <button className="mt-5 h-[45px] rounded-control bg-primary px-4 text-sm font-semibold text-primary-soft" type="button">Confirm</button>
      </section>
    </section>
  );
}
