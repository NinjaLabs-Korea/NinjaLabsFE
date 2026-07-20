import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import type { Notice } from "@/lib/types";

type NoticeRowProps = {
  notice: Notice;
};

export function NoticeRow({ notice }: NoticeRowProps) {
  return (
    <Link
      className="block overflow-hidden rounded-card border border-border bg-surface shadow-card transition-shadow hover:shadow-frame focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:flex"
      href={`/notices/${notice.slug}`}
    >
      <div className="aspect-video shrink-0 bg-gradient-to-br from-primary-soft-border to-surface-subtle md:h-[133.5px] md:w-56 md:aspect-auto" />
      <div className="min-w-0 flex-1 p-5">
        <div className="flex items-center justify-between gap-3">
          <Badge>{notice.category}</Badge>
          <span className="shrink-0 text-sm text-ink-muted">{notice.publishedAt}</span>
        </div>
        <h2 className="mt-2 font-display text-xl font-bold tracking-[-0.2px] text-ink">
          {notice.title}
        </h2>
        <p className="mt-2 text-sm text-ink-muted">{notice.excerpt}</p>
      </div>
    </Link>
  );
}
