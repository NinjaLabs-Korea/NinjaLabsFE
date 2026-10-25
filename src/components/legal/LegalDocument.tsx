import { getFormatter, getTranslations } from "next-intl/server";

import { CONTACT_EMAIL } from "@/lib/contact";

/** Bump together with the messages/<locale>/legal.json text. */
export const LEGAL_LAST_UPDATED = "2026-10-25";

type LegalSection = { heading: string; paragraphs?: string[]; items?: string[] };

/** Renders `{email}` in legal copy as a mailto link (raw message arrays are not ICU-interpolated). */
function withEmail(text: string) {
  const [before, ...rest] = text.split("{email}");
  if (!rest.length) return text;
  return (
    <>
      {before}
      <a className="font-semibold text-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href={`mailto:${CONTACT_EMAIL}`}>
        {CONTACT_EMAIL}
      </a>
      {rest.join("{email}")}
    </>
  );
}

export async function LegalDocument({ document }: { document: "privacy" | "terms" }) {
  const t = await getTranslations("legal");
  const format = await getFormatter();
  const sections = t.raw(`${document}.sections`) as LegalSection[];
  const updated = format.dateTime(new Date(`${LEGAL_LAST_UPDATED}T00:00:00Z`), { year: "numeric", month: "long", day: "numeric" });

  return (
    <article className="mx-auto max-w-[768px] px-6 py-16 pb-20">
      <h1 className="font-display text-4xl -tracking-[0.36px] text-ink">{t(`${document}.title`)}</h1>
      <p className="mt-3 text-sm text-ink-muted">{t("lastUpdated", { date: updated })}</p>
      <p className="mt-6 text-base leading-7 text-ink-secondary">{t(`${document}.intro`)}</p>
      {sections.map((section) => (
        <section className="mt-10" key={section.heading}>
          <h2 className="font-display text-xl font-bold text-ink">{section.heading}</h2>
          {section.paragraphs?.map((paragraph) => (
            <p className="mt-3 text-base leading-7 text-ink-secondary" key={paragraph}>{withEmail(paragraph)}</p>
          ))}
          {section.items?.length ? (
            <ul className="mt-3 list-disc space-y-2 pl-5 text-base leading-7 text-ink-secondary">
              {section.items.map((item) => <li key={item}>{withEmail(item)}</li>)}
            </ul>
          ) : null}
        </section>
      ))}
    </article>
  );
}
