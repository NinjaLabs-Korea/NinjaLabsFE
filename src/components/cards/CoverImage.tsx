"use client";

import Image from "next/image";
import { useState } from "react";
import { imageProps } from "@/lib/image";

const placeholderClass = "absolute inset-0 bg-gradient-to-br from-primary-soft-border to-surface-subtle";

/**
 * Card cover with a fallback: when the image fails to load (dead external host, a media id that no longer exists) the card
 * shows the same gradient it uses for "no cover", instead of an empty bordered box. Re-tries when the URL changes.
 */
export function CoverImage({ src, sizes }: { src: string; sizes: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (failedSrc === src) return <div className={placeholderClass} data-cover-fallback="" />;
  return (
    <Image
      {...imageProps(src)}
      alt=""
      className="object-cover"
      fill
      onError={() => setFailedSrc(src)}
      sizes={sizes}
    />
  );
}
