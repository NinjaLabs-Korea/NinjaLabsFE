"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { imageProps } from "@/lib/image";

const placeholderClass = "absolute inset-0 bg-gradient-to-br from-primary-soft-border to-surface-subtle";

/**
 * Card cover with a fallback: when the image fails to load (dead external host, a media id that no longer exists) the card
 * shows the same gradient it uses for "no cover", instead of an empty bordered box. Re-tries when the URL changes.
 */
export function CoverImage({ src, sizes }: { src: string; sizes: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  // The src whose bitmap is still loading. Visible is the default (server HTML, first render, no JS): only once the effect sees an
  // unfinished image is it hidden until onLoad, so the fade-in never gates an image that is already decoded.
  const [fadingSrc, setFadingSrc] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const image = imageRef.current;
    if (image && !(image.complete && image.naturalWidth > 0)) setFadingSrc(src);
  }, [src]);
  if (failedSrc === src) return <div className={placeholderClass} data-cover-fallback="" />;
  return (
    <Image
      {...imageProps(src)}
      alt=""
      className={`object-cover transition-opacity duration-(--motion-slow) ease-out-soft motion-reduce:transition-none ${fadingSrc === src ? "opacity-0" : "opacity-100"}`}
      fill
      onError={() => setFailedSrc(src)}
      onLoad={() => setFadingSrc(null)}
      ref={imageRef}
      sizes={sizes}
    />
  );
}
