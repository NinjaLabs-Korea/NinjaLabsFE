/// <reference types="vite/client" />
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { noticeCategoryFromQuery } from "@/lib/notice-categories";
import { ERROR_COPY } from "@/lib/api/error-copy";
import { BE_ERROR_CODES } from "@/lib/api/be-error-codes";

const root = process.cwd();
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" || entry.name === ".next" ? [] : walk(full);
    return /\.(tsx?|json|md|css)$/.test(entry.name) ? [full] : [];
  });

describe("no em dash (U+2014) in the shipped copy or the community/recruitment code", () => {
  const EM_DASH = String.fromCharCode(0x2014);
  // Older files predate the rule and still carry some; everything this feature owns must be clean, and so must all UI copy.
  const owned = [
    "messages", "src/components/community", "src/components/recruit", "src/components/home", "src/lib/cohorts.ts", "src/lib/cohort-errors.ts",
    "src/lib/community.ts", "src/lib/return-path.ts", "src/lib/api/cohorts.ts", "src/lib/mocks/cohorts.ts",
    "src/app/[locale]/about", "src/app/[locale]/home", "src/app/[locale]/recruit", "src/app/[locale]/admin/recruitment",
    "src/components/admin/RecruitmentManager.tsx", "src/components/admin/CohortApplicationsPanel.tsx", "src/components/admin/CohortReviewDialog.tsx",
  ];
  const filesOf = (path: string) => (/\.[a-z]+$/.test(path) ? [join(root, path)] : walk(join(root, path)));
  it("is absent from messages and from the files this feature owns", () => {
    const offenders = owned.flatMap(filesOf).filter((file) => readFileSync(file, "utf8").includes(EM_DASH));
    expect(offenders.map((file) => file.replace(root, ""))).toEqual([]);
  });
});

describe("cohort recruitment error codes", () => {
  const COHORT_CODES = [
    "COHORT_NOT_FOUND", "COHORT_APPLICATION_NOT_FOUND", "COHORT_NOT_ACCEPTING", "COHORT_ALREADY_APPLIED", "COHORT_APPLICATION_NOT_SUBMITTED",
    "COHORT_APPLICATION_WITHDRAWN", "COHORT_ALREADY_OPEN", "COHORT_HAS_APPLICATIONS", "COHORT_OTHER_DETAIL_REQUIRED", "COHORT_INVALID_WINDOW", "COHORT_INVALID_TRANSITION",
  ];
  it("are in the BE snapshot", () => {
    for (const code of COHORT_CODES) expect(BE_ERROR_CODES as readonly string[], code).toContain(code);
  });

  it("each has user-facing copy on the screen that can raise it (applicant form, withdraw, or the operator console)", () => {
    const covered = new Set<string>([...ERROR_COPY.cohortApply.codes, ...ERROR_COPY.cohortWithdraw.codes, ...ERROR_COPY.adminCohort.codes]);
    for (const code of COHORT_CODES) expect(covered.has(code), code).toBe(true);
  });
});

describe("noticeCategoryFromQuery (the ?category= link from the community pages)", () => {
  it("maps the message-key spelling of a category, case-insensitively, and ignores anything else", () => {
    expect(noticeCategoryFromQuery("events")).toBe("Events");
    expect(noticeCategoryFromQuery("Events")).toBe("Events");
    expect(noticeCategoryFromQuery(["ninjaLabs", "events"])).toBe("Ninja Labs");
    expect(noticeCategoryFromQuery("injectiveEcosystem")).toBe("Injective ecosystem");
    for (const bad of [undefined, "", "nope", "__proto__"]) expect(noticeCategoryFromQuery(bad)).toBeUndefined();
  });
});

describe("hub copy is not repeated", () => {
  const en = (file: string) => JSON.parse(readFileSync(join(root, "messages", "en", file), "utf8"));
  it("keeps the hero welcome and the /about body different", () => {
    for (const locale of ["ko", "en", "zh"]) {
      const read = (file: string) => JSON.parse(readFileSync(join(root, "messages", locale, file), "utf8"));
      expect(read("landing.json").hero.description, locale).not.toBe(read("community.json").about.body);
    }
    expect(en("landing.json").hero.description).toBe("Developers, marketers, researchers and creators are all welcome.");
  });

  it("writes zh landing and community copy with full-width , ; : after a CJK character", () => {
    const CJK_THEN_ASCII = /[㐀-鿿][,;:]/;
    for (const file of ["landing.json", "community.json"]) {
      const text = readFileSync(join(root, "messages", "zh", file), "utf8");
      expect(CJK_THEN_ASCII.test(text), file).toBe(false);
    }
  });
});
