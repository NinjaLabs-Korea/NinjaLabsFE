import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../../messages");
const locales = readdirSync(root);
const brandCount = (text: string) => text.split("Ninja Labs").length - 1;

type Json = { [key: string]: Json | string };
const walk = (node: Json | string, trail: string[], out: Array<[string, string]>) => {
  if (typeof node === "string") out.push([trail.join("."), node]);
  else for (const [key, value] of Object.entries(node)) walk(value, [...trail, key], out);
  return out;
};

describe("tab titles", () => {
  const cases = locales.flatMap((locale) =>
    readdirSync(path.join(root, locale))
      .filter((file) => file.endsWith(".json"))
      .flatMap((file) => walk(JSON.parse(readFileSync(path.join(root, locale, file), "utf8")), [], []).map(([key, value]) => [`${locale}/${file}`, key, value] as const)),
  );
  const titleKeys = cases.filter(([, key]) => /(^|\.)(metadata\.title|metaTitle|pageTitle)$/.test(key));

  it("finds the title keys", () => {
    expect(titleKeys.length).toBeGreaterThan(10);
  });

  it.each(titleKeys)("%s %s names the brand at most once", (_file, _key, value) => {
    expect(brandCount(value)).toBeLessThanOrEqual(1);
  });

  it("the signup page title (pageTitle + title) names the brand once in every locale", () => {
    for (const locale of locales) {
      const signup = JSON.parse(readFileSync(path.join(root, locale, "signup.json"), "utf8")) as { login: Record<string, { title: string } | string> };
      for (const mode of ["mock", "api"] as const) {
        const title = (signup.login.pageTitle as string).replace("{title}", (signup.login[mode] as { title: string }).title);
        expect(brandCount(title), `${locale} ${mode}: ${title}`).toBe(1);
      }
    }
  });
});
