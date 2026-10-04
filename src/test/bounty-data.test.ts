import { afterEach, describe, expect, it, vi } from "vitest";
import { toBaseUnits, toReward, toRewards } from "@/lib/rewards";

const fetchPublicJson = vi.fn();
vi.mock("@/lib/api/public", () => ({ fetchPublicJson: (path: string) => fetchPublicJson(path) }));
vi.mock("@/lib/runtime/config", () => ({ loadRuntimeConfig: () => ({ runtimeMode: "api" }) }));

const { completionStepsFor, deliverablesFromMarkdown, getRuntimeBounties, loadRuntimeBounties } = await import("@/lib/bounties");

const row = (id: string, rewards = [{ symbol: "INJ", amount: "1500000000000000000", tokenType: "NATIVE" }]) => ({
  id, title: id, summary: "", sponsor_name: "S", category: "DEV", status: "OPEN",
  application_required: false, submission_mode: "DIRECT", cover_image_url: null,
  application_deadline: null, submission_deadline: "2099-01-01T00:00:00Z", rewards,
});

describe("reward conversion", () => {
  it("uses per-token decimals without floating-point loss", () => {
    expect(toReward({ symbol: "INJ", amount: "1500000000000000000" })).toEqual({ amount: 1.5, currency: "INJ" });
    expect(toReward({ symbol: "USDC", amount: "250000000" })).toEqual({ amount: 250, currency: "USDC" });
    expect(toBaseUnits({ amount: 250, currency: "USDC" })).toBe("250000000");
  });

  it("drops unknown symbols and malformed amounts", () => {
    expect(toReward({ symbol: "ATOM", amount: "1" })).toBeNull();
    expect(toReward({ symbol: "INJ", amount: "1.5" })).toBeNull();
    expect(toRewards([{ symbol: "USDC", amount: "1000000" }, { symbol: "ATOM", amount: "1" }])).toEqual([{ amount: 1, currency: "USDC" }]);
  });
});

describe("bounty mapping", () => {
  afterEach(() => fetchPublicJson.mockReset());

  it("extracts deliverables from markdown list items only", () => {
    expect(deliverablesFromMarkdown("Intro paragraph.\n\n- A **public** repo\n* [Preview](https://x.test) URL\n1. `README`\nNot a list")).toEqual([
      "A public repo",
      "Preview URL",
      "README",
    ]);
    expect(deliverablesFromMarkdown(undefined)).toEqual([]);
  });

  it("derives completion steps from the submission mode", () => {
    expect(completionStepsFor("agent")[0]).toBe("Register and verify an agent");
    expect(completionStepsFor("direct")).toHaveLength(3);
  });

  it("loads every page and keeps all reward tokens", async () => {
    fetchPublicJson.mockImplementation(async (path: string) => {
      const page = Number(new URLSearchParams(path.split("?")[1]).get("page"));
      const items = page === 1
        ? Array.from({ length: 50 }, (_, index) => row(`b${index}`))
        : [row("b50", [{ symbol: "INJ", amount: "1000000000000000000", tokenType: "NATIVE" }, { symbol: "USDC", amount: "5000000", tokenType: "ERC20" }])];
      return { items, page, pageSize: 50, total: 51 };
    });
    const bounties = await getRuntimeBounties();
    expect(bounties).toHaveLength(51);
    expect(fetchPublicJson).toHaveBeenCalledTimes(2);
    expect(bounties[0].reward).toEqual({ amount: 1.5, currency: "INJ" });
    expect(bounties[50].rewards).toEqual([{ amount: 1, currency: "INJ" }, { amount: 5, currency: "USDC" }]);
  });

  it("reports an unavailable API instead of throwing", async () => {
    fetchPublicJson.mockRejectedValue(new Error("down"));
    await expect(loadRuntimeBounties()).resolves.toEqual({ bounties: [], unavailable: true });
  });
});
