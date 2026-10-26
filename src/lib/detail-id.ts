import { loadFromRuntime } from "@/lib/api/public";
import { getBounty } from "@/lib/bounties";
import { getProfile } from "@/lib/members";
import { isReservedNickname, NICKNAME as NICKNAME_SHAPE } from "@/lib/nickname";
import { getNotice } from "@/lib/notices";
import type { RuntimeMode } from "@/lib/runtime/config";
import { hasLocale } from "next-intl";
import { type Locale, routing } from "@/i18n/routing";

/** The three public detail routes: `/[locale]/<kind>/[id]`. */
export const detailKinds = ["bounties", "members", "notices"] as const;
export type DetailKind = (typeof detailKinds)[number];

export type DetailRoute = { locale: Locale; kind: DetailKind; id: string };

/** Static pages that share a detail segment's parent (`/bounties/apply` is not a bounty id). */
const staticSiblings: Record<DetailKind, readonly string[]> = { bounties: ["apply"], members: [], notices: [] };

/** mock registries use kebab-case fixture slugs. */
const MOCK_SLUG = /^[a-z0-9-]{1,64}$/;
/** api mode: bounty and notice ids are BE UUIDs (anything else answers 400 before the lookup). */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/**
 * api mode: member ids are BE nicknames - dots allowed inside (`ninja.inj`), never whitespace, control characters or
 * slashes. The edges must be a letter or digit (`lib/nickname.ts NICKNAME`), so the dot segments `.` and `..` are never an
 * id: `/members/%2e%2e` would otherwise make the server request `${api}/users/..`, the BE root. Reserved route words (`lib/nickname.ts RESERVED_NICKNAMES`: `me`, `check-nickname`, `admin`, ...) can never be a
 * profile, so they fail the shape check too.
 */
const NICKNAME = /^[\p{L}\p{N}._-]{1,64}$/u;
const isNicknameShape = (id: string) => NICKNAME.test(id) && NICKNAME_SHAPE.test(id);

/**
 * Shape check only, before any fetch: a garbage id (`%00`, path noise, an overlong string) is a 404 without asking the
 * registry or the BE. `mode` is explicit so the rule is testable; pages go through `validateDetailId`.
 */
export function isValidDetailId(kind: DetailKind, id: string, mode: RuntimeMode): boolean {
  if (mode === "mock") return MOCK_SLUG.test(id);
  return kind === "members" ? isNicknameShape(id) && !isReservedNickname(id) : UUID.test(id);
}

/**
 * Next hands dynamic segments to layouts/pages/generateMetadata percent-encoded when they hold non-ASCII characters
 * (`/members/%EA%B9%80...`), so the nickname shape check failed and every Hangul/Cyrillic/accented profile was a 404.
 * Decode once at the boundary (same rule as `resolveDetailRoute`); an undecodable id becomes `""` and fails the shape check.
 * Idempotent for valid ids: `%` is never part of a nickname, UUID or slug.
 */
export function decodeDetailId(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return "";
  }
}

/** Runtime-mode shape check for the detail pages/layouts (`notFound()` when false, before the record fetch). */
export function validateDetailId(kind: DetailKind, id: string): Promise<boolean> {
  return loadFromRuntime({
    mock: () => isValidDetailId(kind, id, "mock"),
    api: async () => isValidDetailId(kind, id, "api"),
  });
}

/** mock mode: the fixture registries are the source of truth, so the proxy can answer existence without a render. */
export function hasMockDetail(kind: DetailKind, id: string): boolean {
  switch (kind) {
    case "bounties":
      return Boolean(getBounty(id));
    case "members":
      return Boolean(getProfile(id));
    case "notices":
      return Boolean(getNotice(id));
  }
}

/**
 * Proxy-side answer to "can this detail URL exist?": the id shape in both modes (plus the reserved-nickname list for
 * members) and the fixture registry in mock mode. api mode never calls the BE from the proxy: a probe per request would
 * block SSR on BE latency with no timeout and double the calls counted against the 600/min IP throttle. A well-formed
 * but missing id (bounty/notice UUID, member nickname) is left to the page's `notFound()` (status 404, client-rendered
 * boundary).
 */
export function detailMayExist(kind: DetailKind, id: string): Promise<boolean> {
  return loadFromRuntime({
    mock: () => isValidDetailId(kind, id, "mock") && hasMockDetail(kind, id),
    api: async () => isValidDetailId(kind, id, "api"),
  });
}

/**
 * Parses `/[locale]/<kind>/[id]` (exactly three segments, a known locale, a detail kind, a non-empty id, not a static sibling such as
 * `/bounties/apply`). The id is percent-decoded like Next's `params`; an undecodable id is returned as `""` so it fails
 * the shape check.
 */
export function resolveDetailRoute(pathname: string): DetailRoute | null {
  const segments = pathname.split("/");
  if (segments.length !== 4) return null;
  const [, locale, kind, rawId] = segments;
  // `/en/bounties/` (trailing slash) is the list page, not a detail with an empty id.
  if (!rawId) return null;
  if (!hasLocale(routing.locales, locale) || !(detailKinds as readonly string[]).includes(kind)) return null;
  const detailKind = kind as DetailKind;
  let id: string;
  try {
    id = decodeURIComponent(rawId);
  } catch {
    id = "";
  }
  if (staticSiblings[detailKind].includes(id)) return null;
  return { locale, kind: detailKind, id };
}
