/**
 * Member profile photo rules (BE `POST /users/me/avatar`, NinjaLabsBE docs/api-contract.md "온보딩 / 유저").
 * Single source for the upload checks the FE does before sending, and for the codec that admits a BE `avatarUrl` /
 * `avatar_url` into the UI. Dependency-free so server pages, the header and the session hint can all import it.
 */

/** BE `MAX_AVATAR_BYTES` (2 MiB). The BE answers 400 `MEDIA_FILE_TOO_LARGE` above it; the FE checks first to save the upload. */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

/** BE accepts these declared types and checks their magic bytes (`MEDIA_FILE_TYPE_UNSUPPORTED` otherwise). Also the file input `accept`. */
export const AVATAR_ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const MEDIA_PATH = /^\/media\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A BE avatar URL, or `undefined` for "no photo". The BE only ever sends the relative `/media/<uuid>` path (served
 * same-origin through the `/media/:path*` rewrite and optimized by `next/image`); anything else (missing on an older BE,
 * `null`, another shape) means "no photo" and the initials show, so an unexpected value can never point an `<img>` elsewhere.
 */
export function toAvatarUrl(value: unknown): string | undefined {
  return typeof value === "string" && MEDIA_PATH.test(value) ? value : undefined;
}

/** Why a picked file cannot be uploaded, before any request (same codes the BE would answer). */
export function avatarFileProblem(file: Pick<File, "size" | "type">): "MEDIA_FILE_REQUIRED" | "MEDIA_FILE_TYPE_UNSUPPORTED" | "MEDIA_FILE_TOO_LARGE" | null {
  if (file.size === 0) return "MEDIA_FILE_REQUIRED";
  if (!(AVATAR_ACCEPTED_TYPES as readonly string[]).includes(file.type)) return "MEDIA_FILE_TYPE_UNSUPPORTED";
  if (file.size > AVATAR_MAX_BYTES) return "MEDIA_FILE_TOO_LARGE";
  return null;
}
