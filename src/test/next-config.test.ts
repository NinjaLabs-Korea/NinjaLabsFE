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

  it("lets the Cloudflare Turnstile script, challenge iframe and fetches through the report-only CSP", async () => {
    const rules = await nextConfig.headers!();
    const csp = rules.find((rule) => rule.source === "/:path*")!.headers.find((header) => header.key === "Content-Security-Policy-Report-Only")!.value;
    const directive = (name: string) => csp.split("; ").find((part) => part.startsWith(`${name} `))!.split(" ").slice(1);
    for (const name of ["script-src", "frame-src", "connect-src"]) {
      expect(directive(name)).toContain("https://challenges.cloudflare.com");
    }
  });
});
