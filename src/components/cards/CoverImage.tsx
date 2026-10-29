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
  // The src whose bitmap is on screen; keyed by src so a changed URL fades in again instead of keeping the old "loaded" flag.
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  // A cached image can finish before hydration attaches onLoad: without this check it would stay at opacity-0 forever.
  useEffect(() => {
    if (imageRef.current?.complete && imageRef.current.naturalWidth > 0) setLoadedSrc(src);
  }, [src]);
  if (failedSrc === src) return <div className={placeholderClass} data-cover-fallback="" />;
  return (
    <Image
      {...imageProps(src)}
      alt=""
      className={`object-cover transition-opacity duration-(--motion-slow) ease-out-soft motion-reduce:transition-none ${loadedSrc === src ? "opacity-100" : "opacity-0"}`}
      fill
      onError={() => setFailedSrc(src)}
      onLoad={() => setLoadedSrc(src)}
      ref={imageRef}
      sizes={sizes}
    />
  );
}
