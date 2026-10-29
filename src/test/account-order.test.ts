import { describe, expect, it } from "vitest";
import { newestFirst } from "@/lib/account-order";

const row = (id: string, appliedAt: string) => ({ id, appliedAt });

describe("newestFirst (My applications ordering)", () => {
  it("interleaves applications and later direct submissions by time instead of listing submissions last", () => {
    const applications = [row("app-old", "2026-10-26T09:00:00.000Z"), row("app-mid", "2026-10-26T10:00:00.000Z")];
    const standalone = [row("direct-new", "2026-10-26T11:00:00.000Z"), row("direct-oldest", "2026-10-26T08:00:00.000Z")];
    expect(newestFirst([...applications, ...standalone]).map((item) => item.id)).toEqual(["direct-new", "app-mid", "app-old", "direct-oldest"]);
  });

  it("keeps the input order for equal times and puts unparseable times last", () => {
    expect(newestFirst([row("a", "2026-10-26T09:00:00.000Z"), row("b", "2026-10-26T09:00:00.000Z"), row("bad", "nope")]).map((item) => item.id)).toEqual(["a", "b", "bad"]);
  });
});
