"use client";

import { useFormatter } from "next-intl";
import { useEffect, useState } from "react";

import { formatLocalDateTime } from "@/lib/format";

type LocalDateTimeProps = {
  /** ISO instant. Without it (fixtures) the UTC text is all there is. */
  iso?: string;
  /** The server-rendered UTC text; shown first, kept in `title`, and left as the fallback. */
  utcText: string;
};

/**
 * A deadline in the viewer's own time zone. The server and the first client render show `utcText` (so hydration matches and
 * the page is right without JS); after mount it is replaced with the local time and zone name, and the UTC text stays in
 * `title` and in a visually hidden suffix.
 */
export function LocalDateTime({ iso, utcText }: LocalDateTimeProps) {
  const format = useFormatter();
  const [local, setLocal] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser zone is only known after mount
    if (iso) setLocal(formatLocalDateTime(format, iso));
  }, [format, iso]);
  if (!local) return <span>{utcText}</span>;
  return (
    <span title={utcText}>
      {local}
      <span className="sr-only"> ({utcText})</span>
    </span>
  );
}
