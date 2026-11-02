import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function strings(node: unknown, path: string, out: Array<[string, string]> = []): Array<[string, string]> {
  if (typeof node === "string") out.push([path, node]);
  else if (node && typeof node === "object") for (const [key, value] of Object.entries(node)) strings(value, path ? `${path}.${key}` : key, out);
  return out;
}

// The product voice is 해요체. Sentence endings in 합니다체 ("합니다.", "됩니다.", "하십시오") and 한다체 ("한다.") read as
// a different speaker. Short labels, headings and noun phrases are exempt because they do not end in these forms.
// legal.json is a legal document and keeps formal register. admin.json is operator-only copy that is still written in
// 합니다체 (about 190 strings); migrate it in its own PR and then drop it from this list.
const EXEMPT_FILES = new Set(["legal.json", "admin.json"]);
const FORMAL_ENDING = /(합니다|입니다|됩니다|습니다|십시오|십시요|합니까|니까|한다|된다|바랍니다|않는다)(?=[.!?]|\s|$)/;
const files = readdirSync("messages/ko").filter((name) => name.endsWith(".json") && !EXEMPT_FILES.has(name));
const load = (file: string) => strings(JSON.parse(readFileSync(`messages/ko/${file}`, "utf8")), file);

describe("ko copy tone", () => {
  it.each(files)("%s has no 합니다체 or 한다체 sentence endings", (file) => {
    const offenders = load(file)
      .filter(([, text]) => FORMAL_ENDING.test(text.replace(/\{[^{}]*\}/g, "X")))
      .map(([key]) => key);
    expect(offenders).toEqual([]);
  });
});
