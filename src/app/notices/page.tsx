import type { Metadata } from "next";
import { NoticeFilters } from "@/components/notices/NoticeFilters";
import { Badge } from "@/components/ui/Badge";
import { getRuntimeNotices } from "@/lib/notices";


export const metadata: Metadata = {
  title: "Notices — Ninja Labs",
  description: "A builder community and bounty marketplace for the Injective ecosystem.",
};

export default async function NoticesPage() {
  const notices = await getRuntimeNotices();

  return (
    <div className="mx-auto max-w-content px-6 py-16 pb-20">
      <section className="max-w-[896px]">
        <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">News</p>
        <h1 className="font-display text-5xl tracking-[-0.48px] text-ink">Notices</h1>
        <p className="mt-4 text-lg text-ink-muted">
          A builder community and bounty marketplace for the Injective ecosystem.
        </p>
        <div className="mt-4">
          <Badge variant="success">Community feed, not just ops notices</Badge>
        </div>
      </section>

      <div className="mt-8">
        <NoticeFilters notices={notices} />
      </div>
    </div>
  );
}
