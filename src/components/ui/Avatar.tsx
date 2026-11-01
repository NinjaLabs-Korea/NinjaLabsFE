"use client";

import Image from "next/image";
import { useState } from "react";
import { imageProps } from "@/lib/image";

type AvatarProps = {
  /** Shown when there is no photo, or the photo failed to load (e.g. an old cached list pointing at a deleted `/media` row). */
  initials: string;
  /** `/media/<uuid>` admitted by `lib/avatar.ts toAvatarUrl`; absent = initials. */
  avatarUrl?: string;
  /** Size utility (`size-8`, `size-14`, ...). The circle, crop and initials colors are fixed here. */
  sizeClass: string;
  /** Initials typography (`text-[13px] font-bold`, `text-2xl`, ...). */
  textClass?: string;
  /** Initials color; the header chip and `/home` use `text-primary-strong`, the member surfaces `text-primary`. */
  toneClass?: "text-primary" | "text-primary-strong";
  /** `next/image` `sizes`: the rendered CSS width, so the optimizer serves a small file (e.g. `"32px"`). */
  sizes: string;
  /** Extra classes on the circle (layout only: `shrink-0`, margins). */
  className?: string;
  priority?: boolean;
};

/**
 * Member avatar: the profile photo in a circle, or the nickname initials when there is none. Decorative (`aria-hidden`):
 * every place that shows it also shows the nickname as text. One component for the header chip, `/home`, the member
 * cards and the public profile, so a photo looks the same everywhere and a broken photo falls back the same way.
 */
export function Avatar({ initials, avatarUrl, sizeClass, textClass = "font-bold", toneClass = "text-primary-strong", sizes, className = "", priority = false }: AvatarProps) {
  // Remember which URL failed, so a new photo (another URL) is tried again instead of staying on the initials.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const photo = avatarUrl && avatarUrl !== failedUrl ? avatarUrl : null;
  return (
    <span
      aria-hidden="true"
      className={`relative grid ${sizeClass} shrink-0 place-items-center overflow-hidden rounded-full bg-primary-soft-border font-display ${textClass} ${toneClass}${className ? ` ${className}` : ""}`}
      data-avatar={photo ? "photo" : "initials"}
    >
      {photo ? (
        <Image {...imageProps(photo)} alt="" className="object-cover" fill onError={() => setFailedUrl(photo)} priority={priority} sizes={sizes} />
      ) : (
        initials
      )}
    </span>
  );
}
