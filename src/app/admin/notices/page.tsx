import type { Metadata } from "next";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { Badge } from "@/components/ui/Badge";
import { getAdminPosts } from "@/lib/admin";

const postColumns = [
  { id: "title", label: "Title", widthClass: "w-[35%]" },
  { id: "category", label: "Category", widthClass: "w-[22%]" },
  { id: "status", label: "Status", widthClass: "w-[15%]" },
  { id: "published", label: "Published", widthClass: "w-[14%]" },
  { id: "action", label: "Action", widthClass: "w-[14%]" },
];

export const metadata: Metadata = {
  title: "Admin · Notices — Ninja Labs",
  description: "Publish updates and resources for the Ninja Labs community.",
};

export default function AdminNoticesPage() {
  const posts = getAdminPosts();

  return (
    <section className="mx-auto max-w-content px-6 py-16 pb-20">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-[768px]">
          <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">Admin</p>
          <h1 className="font-display text-5xl tracking-[-0.48px] text-ink">Notices</h1>
          <p className="mt-4 text-lg text-ink-muted">
            Publish updates and resources for the Ninja Labs community.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="neutral">ADMIN ONLY</Badge>
          <button className="h-11 rounded-control bg-primary px-4 text-sm font-semibold text-primary-soft">+ New Post</button>
        </div>
      </div>

      <div className="mt-8">
        <AdminTabs active="notices" />
      </div>

      <div className="mt-6 space-y-6">
        <AdminTable columns={postColumns} minWidthClass="min-w-[820px]">
          {posts.map((post) => (
            <tr key={post.slug} className="border-t border-border">
              <td className="px-5 py-4 text-sm font-semibold text-ink">{post.title}</td>
              <td className="px-5 py-4 text-sm text-ink-secondary">{post.category}</td>
              <td className="px-5 py-4"><Badge variant={post.status === "published" ? "success" : "warning"}>{post.status === "published" ? "Published" : "Draft"}</Badge></td>
              <td className="px-5 py-4 text-sm text-ink-secondary">{post.publishedAt ?? "–"}</td>
              <td className="px-5 py-4"><button className="h-11 rounded-control border border-primary-outline bg-surface px-4 text-sm font-semibold text-primary-strong">Edit</button></td>
            </tr>
          ))}
        </AdminTable>

        <section className="rounded-card border border-border bg-surface p-5 shadow-card">
          <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">New post</p>
          <h2 className="font-display text-2xl tracking-[-0.24px] text-ink">New post</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <label className="text-sm font-semibold text-ink">Title<input className="mt-2 h-[46px] w-full rounded-control border border-border px-4 text-sm font-normal text-ink-secondary placeholder:text-ink-placeholder" placeholder="Post title" /></label>
            <label className="text-sm font-semibold text-ink">
              Category
              <div className="mt-2 flex h-[46px] items-center justify-between rounded-control border border-border px-4 text-sm font-normal text-ink-secondary">Ninja Labs <span>▾</span></div>
            </label>
            <label className="text-sm font-semibold text-ink">Thumbnail<div className="mt-2 flex h-[46px] items-center rounded-control border border-border px-4 text-sm font-normal text-ink-placeholder">Upload image</div></label>
            <label className="text-sm font-semibold text-ink">External link<input className="mt-2 h-[46px] w-full rounded-control border border-border px-4 text-sm font-normal text-ink-secondary placeholder:text-ink-placeholder" placeholder="https://" /></label>
            <label className="md:col-span-2 text-sm font-semibold text-ink">Body (markdown)<textarea className="mt-2 min-h-[144px] w-full rounded-control border border-border px-4 py-3 text-sm font-normal text-ink-secondary placeholder:text-ink-placeholder" placeholder="Write your post in markdown" /></label>
            <label className="text-sm font-semibold text-ink">
              Status
              <div className="mt-2 flex h-[46px] items-center justify-between rounded-control border border-border px-4 text-sm font-normal text-ink-secondary">Draft <span>▾</span></div>
            </label>
          </div>
          <button className="mt-5 h-11 rounded-control bg-primary px-4 text-sm font-semibold text-primary-soft">Save</button>
        </section>
      </div>
    </section>
  );
}
