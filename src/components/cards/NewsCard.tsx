import Image from "next/image";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/Badge";
import { Link } from "@/i18n/navigation";
import { safeHttpUrl } from "@/lib/api/codecs";
import { noticeEventDateLabel } from "@/lib/community";
import { imageProps } from "@/lib/image";
import { noticeCategoryKeys } from "@/lib/notice-categories";
import type { NoticePreview } from "@/lib/types";

type NewsCardProps = {
  notice: NoticePreview;
  /** `event`: show the event date ("지난 활동") instead of the publish date; a notice without one falls back to the publish date. */
  dateKind?: "published" | "event";
};

export function NewsCard({ notice, dateKind = "published" }: NewsCardProps) {
  const t = useTranslations("notices.categories");
  const tNotices = useTranslations("notices");
  const eventDate = dateKind === "event" ? noticeEventDateLabel(notice) : "";
  const thumbnail = safeHttpUrl(notice.thumbnail);
  return (
    <Link
      className="block rounded-card border border-border bg-surface p-5 shadow-card transition-shadow hover:shadow-frame focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      href={`/notices/${notice.slug}`}
    >
      {thumbnail ? (
        <div className="relative mb-4 aspect-video overflow-hidden rounded-tile">
          <Image {...imageProps(thumbnail)} alt="" className="object-cover" fill sizes="(max-width: 1024px) 100vw, 370px" />
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <Badge>{t(noticeCategoryKeys[notice.category])}</Badge>
        <span className="text-xs text-ink-muted">{eventDate ? tNotices("eventDate", { date: eventDate }) : notice.publishedAt}</span>
      </div>
      <h3 className="mt-2 line-clamp-2 font-display text-lg font-bold text-ink">{notice.title}</h3>
      <p className="mt-2 line-clamp-2 text-sm text-ink-muted">{notice.excerpt}</p>
    </Link>
  );
}
