import Link from "next/link";
import Image from "next/image";

import { Badge } from "@/components/ui/Badge";
import type { NoticePreview } from "@/lib/types";

type NewsCardProps = {
  notice: NoticePreview;
};

export function NewsCard({ notice }: NewsCardProps) {
  return (
    <Link
      className="block rounded-card border border-border bg-surface p-5 shadow-card transition-shadow hover:shadow-frame focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      href={`/notices/${notice.slug}`}
    >
      {notice.thumbnail ? (
        <div className="relative mb-4 aspect-video overflow-hidden rounded-tile">
          <Image alt="" className="object-cover" fill sizes="(max-width: 1024px) 100vw, 370px" src={notice.thumbnail} />
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <Badge>{notice.category}</Badge>
        <span className="text-xs text-ink-muted">{notice.publishedAt}</span>
      </div>
      <h3 className="mt-2 line-clamp-2 font-display text-lg font-bold text-ink">{notice.title}</h3>
      <p className="mt-2 line-clamp-2 text-sm text-ink-muted">{notice.excerpt}</p>
    </Link>
  );
}
