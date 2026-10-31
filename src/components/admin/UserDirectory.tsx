"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { AdminTable, adminLongTextCell } from "@/components/admin/AdminTable";
import { pushAdminToast } from "@/components/admin/AdminToastHost";
import { UserActions } from "@/components/admin/UserActions";
import { Badge } from "@/components/ui/Badge";
import { type AdminUser, adminErrorDescription, expirePublicLists } from "@/lib/admin-helpers";
import { useAdminApi } from "@/components/auth/FoundationProvider";

const columns = [
  { id: "nickname", widthClass: "w-[157px]" },
  { id: "email", widthClass: "w-[286px]" },
  { id: "joined", widthClass: "w-[125px]" },
  { id: "wallet", widthClass: "w-[138px]" },
  { id: "member", widthClass: "w-[140px]" },
  { id: "role", widthClass: "w-[105px]" },
  { id: "action", widthClass: "w-[199px]" },
];

/** BE `MemberAdminService.PAGE_SIZE`. */
const USERS_PAGE_SIZE = 30;
/** BE `SearchUsersQueryDto.q` `@MaxChars(320)` (the longest email): a longer term is a 400 on every pause, so the box stops accepting more. */
const SEARCH_TERM_MAX = 320;
/** Pause after the last keystroke before the search term goes to the BE. */
export const SEARCH_DEBOUNCE_MS = 300;

/** `existing` plus the `incoming` users it does not hold yet (a signup between two requests shifts rows across page boundaries). */
const withNewUsers = (existing: AdminUser[], incoming: AdminUser[]) => [...existing, ...incoming.filter((user) => !existing.some((known) => known.slug === user.slug))];

export function UserDirectory({ users }: { users: AdminUser[] }) {
  const api = useAdminApi();
  const t = useTranslations("admin.users");
  const tCommon = useTranslations("admin.common");
  const [query, setQuery] = useState("");
  const [directoryUsers, setDirectoryUsers] = useState(users);
  // The BE returns 30 users per page; a shorter first page means there is nothing more to load.
  const [nextPage, setNextPage] = useState(2);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // Paging of the settled search term (`GET /admin/users?q=&page=`): a term with more than one page of matches would otherwise
  // dead-end after 30 hits while "Load more" fetched the unfiltered directory.
  const [search, setSearch] = useState<{ term: string; nextPage: number; hasMore: boolean } | null>(null);
  // api mode renders with no rows and reads the directory after mount: "no users found" only once that read answered empty.
  const [loadState, setLoadState] = useState<"loading" | "ready" | "failed">(users.length ? "ready" : "loading");
  const term = query.trim();
  const normalizedQuery = term.toLowerCase();
  // Only the search that belongs to the term in the box counts (the debounce has not caught up yet, or the term was cleared).
  const activeSearch = term && search?.term === term ? search : null;
  const canLoadMore = term ? (activeSearch?.hasMore ?? false) : hasMore;
  const visibleUsers = directoryUsers.filter((user) => (
    user.nickname.toLowerCase().includes(normalizedQuery) || user.email.toLowerCase().includes(normalizedQuery)
  ));

  // The first read can land after a debounced search already merged its hits: keep them (the loaded page wins for users in both).
  const loadDirectory = useCallback(() => api.getAdminUsers().then((loaded) => {
    setDirectoryUsers((existing) => withNewUsers(loaded, existing));
    setNextPage(2);
    setHasMore(loaded.length >= USERS_PAGE_SIZE);
    setLoadState("ready");
  }).catch(() => {
    setLoadState((current) => (current === "ready" ? current : "failed"));
    pushAdminToast({ variant: "danger", title: t("toast.loadFailedTitle"), description: t("toast.loadFailedDescription") });
  }), [api, t]);

  useEffect(() => {
    void loadDirectory();
  }, [loadDirectory]);

  // The table filters the loaded users instantly; after a pause the term also goes to the BE (`q` is ILIKE on
  // email/nickname) and users not loaded yet are merged in, so one beyond the first pages is found without paging to them.
  useEffect(() => {
    const settled = query.trim();
    if (!settled) return;
    let current = true;
    const timer = setTimeout(() => {
      api.getAdminUsers(settled).then(
        (found) => {
          setDirectoryUsers((existing) => withNewUsers(existing, found));
          if (current) setSearch({ term: settled, nextPage: 2, hasMore: found.length >= USERS_PAGE_SIZE });
        },
        () => pushAdminToast({ variant: "danger", title: t("toast.loadFailedTitle"), description: t("toast.loadFailedDescription") }),
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [api, query, t]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      if (activeSearch) {
        const loaded = await api.getAdminUsers(activeSearch.term, activeSearch.nextPage);
        setDirectoryUsers((current) => withNewUsers(current, loaded));
        setSearch((current) => (current?.term === activeSearch.term ? { term: activeSearch.term, nextPage: activeSearch.nextPage + 1, hasMore: loaded.length >= USERS_PAGE_SIZE } : current));
      } else {
        const loaded = await api.getAdminUsers("", nextPage);
        setDirectoryUsers((current) => withNewUsers(current, loaded));
        setNextPage((current) => current + 1);
        setHasMore(loaded.length >= USERS_PAGE_SIZE);
      }
    } catch {
      pushAdminToast({ variant: "danger", title: t("toast.loadFailedTitle"), description: t("toast.loadFailedDescription") });
    } finally {
      setLoadingMore(false);
    }
  }

  async function restoreMember(user: AdminUser) {
    // Called from the toast's Undo action, which does not await it: a rejection must become a toast, not an unhandled error.
    try {
      await api.setAdminMember(user.slug, { isMember: user.isMember, ...(user.memberRole ? { role: user.memberRole } : {}), ...(user.memberDisplayOrder !== null ? { displayOrder: user.memberDisplayOrder } : {}) });
      expirePublicLists(["members"]);
    } catch (error) {
      pushAdminToast({ variant: "danger", title: t("toast.updateFailedTitle"), description: adminErrorDescription(error, tCommon, t("toast.removeFailedDescription")) });
      return;
    }
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
      title: t("toast.restoredTitle"),
      description: t("toast.restoredDescription", { nickname: user.nickname }),
    });
  }

  async function handleRemove(user: AdminUser) {
    try {
      await api.setAdminMember(user.slug, { isMember: false });
      expirePublicLists(["members"]);
    } catch (error) {
      pushAdminToast({ variant: "danger", title: t("toast.updateFailedTitle"), description: adminErrorDescription(error, tCommon, t("toast.removeFailedDescription")) });
      return;
    }
    setDirectoryUsers((currentUsers) => currentUsers.map((currentUser) => (
      currentUser.slug === user.slug
        ? { ...currentUser, isMember: false, memberRole: null, memberDisplayOrder: null }
        : currentUser
    )));
    pushAdminToast({
      variant: "info",
      title: t("toast.removedTitle"),
      description: t("toast.removedDescription", { nickname: user.nickname }),
      actionLabel: t("toast.undo"),
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
      expirePublicLists(["members"]);
    } catch (error) {
      pushAdminToast({ variant: "danger", title: t("toast.updateFailedTitle"), description: adminErrorDescription(error, tCommon, t("toast.assignFailedDescription")) });
      return;
    }
    setDirectoryUsers((currentUsers) => currentUsers.map((currentUser) => (
      currentUser.slug === user.slug
        ? { ...currentUser, isMember: true, memberRole: role, memberDisplayOrder: displayOrder }
        : currentUser
    )));
    pushAdminToast({
      variant: "success",
      title: t("toast.assignedTitle"),
      description: t("toast.assignedDescription", { nickname: user.nickname }),
    });
  }

  return (
    <>
      <div className="mt-6 rounded-card border border-border bg-surface p-[21px] shadow-card">
        <label className="block text-sm font-semibold text-ink" htmlFor="user-search">{t("searchLabel")}</label>
        <input
          id="user-search"
          maxLength={SEARCH_TERM_MAX}
          className="mt-2 h-[46px] w-full rounded-control border border-border px-[17px] text-sm text-ink placeholder:text-ink-placeholder focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:w-[384px]"
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("searchPlaceholder")}
          type="search"
          value={query}
        />
      </div>

      {visibleUsers.length > 0 ? (
        <div className="mt-6">
          <AdminTable columns={columns.map((column) => ({ ...column, label: t(`columns.${column.id}`) }))} minWidthClass="min-w-[1120px]">
            {visibleUsers.map((user) => (
              <tr className="border-t border-border" key={user.slug}>
                <td className={`px-5 py-4 text-sm font-semibold text-ink ${adminLongTextCell}`}>{user.nickname}</td>
                <td className={`px-5 py-4 text-sm text-ink-muted ${adminLongTextCell}`}>{user.email}</td>
                <td className="whitespace-nowrap px-5 py-4 text-sm text-ink-secondary">{user.joinedAt || "–"}</td>
                <td className="px-5 py-4 text-sm text-ink-secondary">
                  {user.walletStatus === "linked" ? <Badge variant="success">{t("walletLinked")}</Badge> : "-"}
                </td>
                <td className="px-5 py-4 text-sm text-ink-secondary">
                  {user.isMember ? <Badge variant="success">{t("memberYes")}</Badge> : "-"}
                </td>
                <td className="px-5 py-4 text-sm text-ink-secondary">{user.memberRole ? t(`roles.${user.memberRole}`) : "-"}</td>
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
          {canLoadMore ? (
            <div className="mt-4 flex justify-center">
              <button className="rounded-control border border-primary-outline px-4 py-2 max-sm:py-2.5 text-sm font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60" disabled={loadingMore} onClick={() => void loadMore()} type="button">{t("loadMore")}</button>
            </div>
          ) : null}
          <p className="mt-3 text-xs text-ink-muted">{tCommon("saveNotice")}</p>
        </div>
      ) : directoryUsers.length === 0 && loadState !== "ready" ? (
        <p className="mt-6 flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface p-[21px] text-sm text-ink-muted shadow-card" role="status">
          {loadState === "failed" ? t("toast.loadFailedDescription") : t("loading")}
          {loadState === "failed" ? <button className="rounded-control border border-primary-outline px-3 py-2 max-sm:py-2.5 text-sm font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={() => { setLoadState("loading"); void loadDirectory(); }} type="button">{t("retry")}</button> : null}
        </p>
      ) : (
        <div className="mt-6 rounded-tile border border-dashed border-border-dashed bg-surface-subtle p-10 text-center">
          <p className="text-sm font-semibold text-ink">{t("emptyTitle")}</p>
          <p className="mt-1 text-sm text-ink-muted">{t("emptyBody")}</p>
          <button
            className="mt-4 rounded-control border border-primary-outline px-4 py-2 max-sm:py-2.5 text-sm font-semibold text-primary-strong hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            onClick={() => setQuery("")}
            type="button"
          >
            {t("resetSearch")}
          </button>
        </div>
      )}
    </>
  );
}
