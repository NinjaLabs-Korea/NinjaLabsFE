import type { Locale } from "./routing";

// One JSON file per namespace per locale: messages/<locale>/<namespace>.json.
// Add a namespace here when a new file is created.
export const namespaces = [
  "common",
  "landing",
  "notices",
  "members",
  "hallOfFame",
  "signup",
  "bounties",
  "account",
  "agents",
  "admin",
  "legal",
] as const;

export type Namespace = (typeof namespaces)[number];

export type Messages = Record<string, unknown>;

/**
 * Subset of the request messages for a client boundary: the shell `NextIntlClientProvider` ships `common` only,
 * pages wrap their client islands with `layout/PageMessages` (nested provider) and name the extra namespaces.
 */
export function pickMessages(messages: Messages, picked: readonly Namespace[]): Messages {
  return Object.fromEntries(picked.filter((ns) => ns in messages).map((ns) => [ns, messages[ns]]));
}

/** One namespace file, without the request context (e.g. metadata image routes that run at build time). */
export async function loadNamespace(locale: Locale, ns: Namespace): Promise<Messages> {
  const mod = (await import(`../../messages/${locale}/${ns}.json`)) as { default: Messages };
  return mod.default;
}

export async function loadMessages(locale: Locale) {
  const entries = await Promise.all(namespaces.map(async (ns) => [ns, await loadNamespace(locale, ns)] as const));
  return Object.fromEntries(entries);
}
