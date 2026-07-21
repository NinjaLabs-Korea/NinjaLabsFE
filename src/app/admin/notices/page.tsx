import type { Metadata } from "next";
import { AdminToastHost } from "@/components/admin/AdminToastHost";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { PostManager } from "@/components/admin/PostManager";
import { Badge } from "@/components/ui/Badge";
import { getAdminPosts } from "@/lib/admin";

export const metadata: Metadata = {
  title: "Admin · Notices — Ninja Labs",
  description: "Publish updates and resources for the Ninja Labs community.",
};

export default function AdminNoticesPage() {
  const posts = getAdminPosts();

  return (
    <section className="relative mx-auto max-w-content px-6 py-16 pb-20">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-[768px]">
          <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">Admin</p>
          <h1 className="font-display text-5xl tracking-[-0.48px] text-ink">Notices</h1>
          <p className="mt-4 text-lg text-ink-muted">
            Publish updates and resources for the Ninja Labs community.
          </p>
        </div>
        <div className="mr-[115px] flex items-center gap-3">
          <Badge variant="neutral">ADMIN ONLY</Badge>
        </div>
      </div>

      <div className="mt-8">
        <AdminTabs active="notices" />
      </div>

      <PostManager posts={posts} />
      <AdminToastHost />
    </section>
  );
}
