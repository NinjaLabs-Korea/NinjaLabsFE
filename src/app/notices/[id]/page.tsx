import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/Badge";
import { getNotice, getNotices } from "@/lib/notices";

type NoticeDetailPageProps = {
  params: Promise<{ id: string }>;
};

export function generateStaticParams() {
  return getNotices().map(({ slug }) => ({ id: slug }));
}
export async function generateMetadata({ params }: NoticeDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const notice = getNotice(id);

  if (!notice) {
    return { title: "Not found — Ninja Labs" };
  }

  return {
    title: `${notice.title} — Ninja Labs`,
    description: notice.excerpt,
  };
}

export default async function NoticeDetailPage({ params }: NoticeDetailPageProps) {
  const { id } = await params;
  const notice = getNotice(id);

  if (!notice) {
    notFound();
  }

  const paragraphs = notice.bodyMarkdown.split("\n\n").filter(Boolean);

  return (
    <div className="mx-auto max-w-content px-6 py-16 pb-20">
      <div className="flex items-center justify-between gap-4">
        <Link
          className="text-sm font-semibold text-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          href="/notices"
        >
          ← Back to list
        </Link>
        <Badge variant="success">Public</Badge>
      </div>

      <section className="mt-8 max-w-[896px]">
        <div className="flex flex-wrap items-center gap-3">
          <Badge>{notice.category}</Badge>
          <span className="text-sm text-ink-muted">{notice.publishedAt}</span>
        </div>
        <h1 className="mt-5 font-display text-5xl tracking-[-0.48px] text-ink">{notice.title}</h1>
        <p className="mt-5 text-lg text-ink-muted">{notice.excerpt}</p>
      </section>

      <div className="mt-8 aspect-video rounded-card bg-gradient-to-br from-primary-soft-border to-surface-subtle" />

      <div className="mt-8 grid gap-8 md:grid-cols-4">
        <article className="rounded-card border border-border bg-surface p-5 shadow-card md:col-span-3">
          <div className="space-y-5 text-base text-ink-secondary">
            {paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
          {notice.externalUrl ? (
            <div className="mt-6 rounded-tile border border-border bg-primary-soft p-5">
              <h2 className="font-display text-lg font-bold text-ink">Read more</h2>
              <a
                className="mt-2 inline-block text-base font-semibold text-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                href={notice.externalUrl}
              >
                Read more →
              </a>
            </div>
          ) : null}
        </article>

        {notice.related ? (
          <aside className="h-fit rounded-card border border-border bg-surface p-5 shadow-card">
            <p className="text-xs font-bold uppercase tracking-[0.96px] text-primary">Related</p>
            <ul className="mt-4 space-y-3">
              {notice.related.map((related) => (
                <li key={related.href}>
                  <Link
                    className="text-base font-semibold text-ink hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    href={related.href}
                  >
                    {related.label}
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
