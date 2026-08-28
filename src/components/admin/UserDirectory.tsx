"use client";

import { useEffect, useState } from "react";
import { AdminTable } from "@/components/admin/AdminTable";
import { pushAdminToast } from "@/components/admin/AdminToastHost";
import { UserActions } from "@/components/admin/UserActions";
import { Badge } from "@/components/ui/Badge";
import type { AdminUser } from "@/lib/admin";
import { useFoundationApiClient, useFoundationMode } from "@/components/auth/FoundationProvider";

const columns = [
  { id: "nickname", label: "Nickname", widthClass: "w-[157px]" },
  { id: "email", label: "Email", widthClass: "w-[286px]" },
  { id: "joined", label: "Joined", widthClass: "w-[125px]" },
  { id: "wallet", label: "Wallet", widthClass: "w-[138px]" },
  { id: "member", label: "Member", widthClass: "w-[140px]" },
  { id: "role", label: "Role", widthClass: "w-[105px]" },
  { id: "action", label: "Action", widthClass: "w-[199px]" },
];

export function UserDirectory({ users }: { users: AdminUser[] }) {
  const api = useFoundationApiClient();
  const foundationMode = useFoundationMode();
  const [query, setQuery] = useState("");
  const [directoryUsers, setDirectoryUsers] = useState(users);
  const normalizedQuery = query.toLowerCase();
  const visibleUsers = directoryUsers.filter((user) => (
    user.nickname.toLowerCase().includes(normalizedQuery) || user.email.toLowerCase().includes(normalizedQuery)
  ));

  useEffect(() => {
    if (foundationMode !== "api") return;
    api.getAdminUsers().then(setDirectoryUsers).catch(() => pushAdminToast({ variant: "danger", title: "Users unavailable", description: "Could not load the admin user directory." }));
  }, [api, foundationMode]);

  async function restoreMember(user: AdminUser) {
    await api.setAdminMember(user.slug, { isMember: user.isMember, ...(user.memberRole ? { role: user.memberRole } : {}), ...(user.memberDisplayOrder !== null ? { displayOrder: user.memberDisplayOrder } : {}) });
    setDirectoryUsers((currentUsers) => currentUsers.map((currentUser) => (
      currentUser.slug === user.slug
        ? {
            ...currentUser,
            isMember: user.isMember,
            memberRole: user.memberRole,
            memberDisplayOrder: user.memberDisplayOrder,
          }
        : currentUser
    )));
    pushAdminToast({
      variant: "success",
      title: "Member restored",
      description: `${user.nickname} was restored.`,
    });
  }

  async function handleRemove(user: AdminUser) {
    try {
      await api.setAdminMember(user.slug, { isMember: false });
    } catch {
      pushAdminToast({ variant: "danger", title: "Update failed", description: "The member assignment was not changed." });
      return;
    }
    setDirectoryUsers((currentUsers) => currentUsers.map((currentUser) => (
      currentUser.slug === user.slug
        ? { ...currentUser, isMember: false, memberRole: null, memberDisplayOrder: null }
        : currentUser
    )));
    pushAdminToast({
      variant: "info",
      title: "Member removed",
      description: `${user.nickname} was removed from the public member directory.`,
      actionLabel: "Undo",
      onAction: () => restoreMember(user),
    });
  }

  async function handleAssign(
    user: AdminUser,
    role: NonNullable<AdminUser["memberRole"]>,
    displayOrder: number | null,
  ) {
    try {
      await api.setAdminMember(user.slug, { isMember: true, role, ...(displayOrder !== null ? { displayOrder } : {}) });
    } catch {
      pushAdminToast({ variant: "danger", title: "Update failed", description: "The member role was not changed." });
      return;
    }
    setDirectoryUsers((currentUsers) => currentUsers.map((currentUser) => (
      currentUser.slug === user.slug
        ? { ...currentUser, isMember: true, memberRole: role, memberDisplayOrder: displayOrder }
        : currentUser
    )));
    pushAdminToast({
      variant: "success",
      title: "Member role assigned",
      description: `${user.nickname} is now visible in the public member directory.`,
    });
  }

  return (
    <>
      <div className="mt-6 rounded-card border border-border bg-surface p-[21px] shadow-card">
        <label className="block text-sm font-semibold text-ink" htmlFor="user-search">Search users</label>
        <input
          id="user-search"
          className="mt-2 h-[46px] w-full rounded-control border border-border px-[17px] text-sm text-ink outline-none placeholder:text-ink-placeholder sm:w-[384px]"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by email / nickname"
          type="search"
          value={query}
        />
      </div>

      {visibleUsers.length > 0 ? (
        <div className="mt-6">
          <AdminTable columns={columns} minWidthClass="min-w-[820px]">
            {visibleUsers.map((user) => (
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
                  <UserActions
                    onAssign={(role, displayOrder) => handleAssign(user, role, displayOrder)}
                    onRemove={() => handleRemove(user)}
                    user={user}
                  />
                </td>
              </tr>
            ))}
          </AdminTable>
          <p className="mt-3 text-xs text-ink-muted">Changes are saved to the platform immediately.</p>
        </div>
      ) : (
        <div className="mt-6 rounded-tile border border-dashed border-border-dashed bg-surface-subtle p-10 text-center">
          <p className="text-sm font-semibold text-ink">No users match your search</p>
          <p className="mt-1 text-sm text-ink-muted">Try a different email or nickname.</p>
          <button
            className="mt-4 rounded-control border border-primary-outline px-4 py-2 text-sm font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            onClick={() => setQuery("")}
            type="button"
          >
            Reset search
          </button>
        </div>
      )}
    </>
  );
}
