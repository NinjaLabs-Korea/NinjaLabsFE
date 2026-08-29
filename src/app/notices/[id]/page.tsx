import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/Badge";
import { Markdown } from "@/components/ui/Markdown";
import { getRuntimeNotice } from "@/lib/notices";

type NoticeDetailPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: NoticeDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const notice = await getRuntimeNotice(id);

  if (!notice) {
    return { title: "Not found — Ninja Labs" };
  }

  return {
    title: `${notice.title} — Ninja Labs`,
    description: notice.excerpt,
    openGraph: {
      title: `${notice.title} — Ninja Labs`,
      description: notice.excerpt,
      url: `/notices/${notice.slug}`,
    },
  };
}

export default async function NoticeDetailPage({ params }: NoticeDetailPageProps) {
  const { id } = await params;
  const notice = await getRuntimeNotice(id);

  if (!notice) {
    notFound();
  }

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

      <div className="relative mt-8 aspect-video overflow-hidden rounded-card bg-gradient-to-br from-primary-soft-border to-surface-subtle">
        {notice.coverImage ? <Image alt="" className="object-cover" fill priority sizes="(max-width: 1200px) 100vw, 1152px" src={notice.coverImage} /> : null}
      </div>

      <div className="mt-8 grid gap-8 md:grid-cols-4">
        <article className="rounded-card border border-border bg-surface p-5 shadow-card md:col-span-3">
          <div className="text-base text-ink-secondary">
            <Markdown>{notice.bodyMarkdown}</Markdown>
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
