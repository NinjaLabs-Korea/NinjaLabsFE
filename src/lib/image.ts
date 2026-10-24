/**
 * `next/image` props for an image URL that `safeHttpUrl` admitted.
 *
 * The optimizer (`/_next/image`) only accepts same-origin paths and the `images.remotePatterns`
 * from `next.config.ts` (the API origin's `/media/**` and `NINJA_APP_ORIGIN`); every other absolute
 * URL would answer 400. Admin-entered covers/thumbnails/logos can point anywhere, so those render
 * `unoptimized` (a plain `<img>` under the hood) instead of breaking. `next.config.ts` inlines the
 * optimizable prefixes as `NINJA_OPTIMIZED_IMAGE_PREFIXES` (comma-separated, trailing slash) so the
 * client bundle agrees with the server config.
 */

const optimizedPrefixes = (process.env.NINJA_OPTIMIZED_IMAGE_PREFIXES ?? "")
  .split(",")
  .filter((prefix) => prefix !== "");

export type ImageSourceProps = { src: string; unoptimized?: true };

export function imageProps(url: string): ImageSourceProps {
  // Local images with a query string need `images.localPatterns.search` since Next 16; skip the optimizer.
  const optimized = url.startsWith("/")
    ? !url.includes("?")
    : optimizedPrefixes.some((prefix) => url.startsWith(prefix));
  return optimized ? { src: url } : { src: url, unoptimized: true };
}
