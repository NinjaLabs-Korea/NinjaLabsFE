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
] as const;

export type Namespace = (typeof namespaces)[number];

export async function loadMessages(locale: Locale) {
  const entries = await Promise.all(
    namespaces.map(async (ns) => {
      const mod = (await import(`../../messages/${locale}/${ns}.json`)) as { default: Record<string, unknown> };
      return [ns, mod.default] as const;
    }),
  );
  return Object.fromEntries(entries);
}
