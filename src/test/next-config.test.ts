import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("next.config security headers", () => {
  it("does not advertise the framework", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it("forbids plugins in the report-only CSP and keeps it report-only", async () => {
    const rules = await nextConfig.headers!();
    const headers = rules.find((rule) => rule.source === "/:path*")!.headers;
    const csp = headers.find((header) => header.key === "Content-Security-Policy-Report-Only")!.value;
    expect(csp.split("; ")).toContain("object-src 'none'");
    expect(headers.some((header) => header.key === "Content-Security-Policy")).toBe(false);
  });
});
