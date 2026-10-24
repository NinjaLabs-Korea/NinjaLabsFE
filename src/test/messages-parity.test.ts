/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { namespaces } from "@/i18n/messages";
import { routing } from "@/i18n/routing";

// Every locale must ship the same key set per namespace, and each key must use the same ICU placeholder names,
// so a missing/renamed key can never surface as a raw key path or a runtime format error in one locale only.
const files = import.meta.glob("../../messages/*/*.json", { eager: true, import: "default" }) as Record<
  string,
  Record<string, unknown>
>;

function flatten(value: unknown, prefix = ""): Record<string, string> {
  if (typeof value === "string") return { [prefix]: value };
  if (!value || typeof value !== "object") throw new Error(`Unexpected message value at ${prefix}`);
  return Object.assign(
    {},
    ...Object.entries(value as Record<string, unknown>).map(([key, child]) => flatten(child, prefix ? `${prefix}.${key}` : key)),
  );
}

/**
 * ICU argument names: `{name}`, `{count, plural, one {# day} other {# days}}`, `{to, select, OPEN {open} other {closed}}`,
 * `{date, date, short}`. Branch bodies are parsed recursively (so `{n}` inside a plural counts) while their literal text
 * (`{open}`) does not; `'{'`-quoted text is skipped. Rich-text tags (`<link>`) are not placeholders.
 */
function placeholders(message: string): string[] {
  const names: string[] = [];
  let index = 0;

  const skipWhitespace = () => {
    while (index < message.length && /\s/.test(message[index])) index += 1;
  };

  const parseMessage = (nested: boolean) => {
    while (index < message.length) {
      const char = message[index];
      if (char === "'" && "{}#'".includes(message[index + 1] ?? "")) {
        if (message[index + 1] === "'") { index += 2; continue; }
        const close = message.indexOf("'", index + 1);
        index = close === -1 ? message.length : close + 1;
        continue;
      }
      if (char === "}") {
        index += 1;
        if (nested) return;
        continue;
      }
      if (char === "{") { parseArgument(); continue; }
      index += 1;
    }
  };

  const parseArgument = () => {
    index += 1; // "{"
    skipWhitespace();
    const name = /^[A-Za-z_][\w]*/.exec(message.slice(index))?.[0];
    if (!name) throw new Error(`Malformed ICU argument at ${index} in: ${message}`);
    names.push(name);
    index += name.length;
    skipWhitespace();
    if (message[index] === "}") { index += 1; return; }
    if (message[index] !== ",") throw new Error(`Malformed ICU argument "${name}" in: ${message}`);
    index += 1;
    skipWhitespace();
    const type = /^[A-Za-z]+/.exec(message.slice(index))?.[0] ?? "";
    index += type.length;
    skipWhitespace();
    if (message[index] === "}") { index += 1; return; }
    index += 1; // ","
    if (type === "plural" || type === "select" || type === "selectordinal") {
      for (;;) {
        skipWhitespace();
        if (index >= message.length) throw new Error(`Unterminated ${type} "${name}" in: ${message}`);
        if (message[index] === "}") { index += 1; return; }
        const token = /^[^\s{}]+/.exec(message.slice(index))?.[0] ?? "";
        index += token.length;
        if (token.startsWith("offset:")) continue;
        skipWhitespace();
        if (message[index] !== "{") throw new Error(`Expected branch body for "${name}" in: ${message}`);
        index += 1;
        parseMessage(true);
      }
    }
    // number/date/time style: plain text up to the closing brace
    const close = message.indexOf("}", index);
    index = close === -1 ? message.length : close + 1;
  };

  parseMessage(false);
  return names.sort();
}

describe("ICU placeholder extraction", () => {
  it("collects argument names through plural/select branches and ignores branch text and quoted braces", () => {
    expect(placeholders("Applied {date}")).toEqual(["date"]);
    expect(placeholders("{title} is now {to, select, OPEN {open} other {submission closed}}.")).toEqual(["title", "to"]);
    expect(placeholders("{count, plural, one {# agent for {name}} other {# agents}}")).toEqual(["count", "name"]);
    expect(placeholders("Literal '{' brace and <link>tag</link>")).toEqual([]);
  });
});

describe("message parity across locales", () => {
  const locales = routing.locales;
  const reference = locales[0];

  it("ships exactly the registered namespaces as JSON files in every locale (no stray or missing files)", () => {
    const expected = [...namespaces].sort();
    for (const locale of locales) {
      const prefix = `../../messages/${locale}/`;
      const present = Object.keys(files)
        .filter((path) => path.startsWith(prefix))
        .map((path) => path.slice(prefix.length).replace(/\.json$/, ""))
        .sort();
      expect(present, `messages/${locale}/*.json vs src/i18n/messages.ts namespaces`).toEqual(expected);
    }
    // No files outside the three locale folders either.
    const localeFolders = new Set(Object.keys(files).map((path) => path.split("/")[3]));
    expect([...localeFolders].sort()).toEqual([...locales].sort());
  });

  for (const namespace of namespaces) {
    it(`keeps messages/<locale>/${namespace}.json identical in shape for ${locales.join("/")}`, () => {
      const flat = Object.fromEntries(
        locales.map((locale) => {
          const messages = files[`../../messages/${locale}/${namespace}.json`];
          expect(messages, `${locale}/${namespace}.json missing`).toBeDefined();
          return [locale, flatten(messages)];
        }),
      );
      const referenceKeys = Object.keys(flat[reference]).sort();
      for (const locale of locales) {
        expect(Object.keys(flat[locale]).sort(), `${locale}/${namespace}.json keys`).toEqual(referenceKeys);
        for (const key of referenceKeys) {
          expect(placeholders(flat[locale][key]), `${locale}/${namespace}.json ${key} placeholders`).toEqual(
            placeholders(flat[reference][key]),
          );
        }
      }
    });
  }
});
