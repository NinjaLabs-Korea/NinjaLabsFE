import { afterEach, describe, expect, it, vi } from "vitest";
import nextConfig from "../../next.config";

/**
 * CSP 규칙 문서 역할을 하는 테스트. 규칙을 바꾸려면 `next.config.ts`의 `cspMode()` / `contentSecurityPolicy()`를
 * 고치고 여기 기대값을 같이 고친다.
 * - production 빌드: `Content-Security-Policy` (실제 차단), `'unsafe-eval'` 없음.
 * - dev / test: `Content-Security-Policy-Report-Only` (콘솔 경고만), dev 서버용 `'unsafe-eval'` 허용.
 * `headers()`는 호출 시점의 NODE_ENV를 읽으므로 모듈을 다시 불러올 필요 없이 env만 바꾼다.
 */
const ENFORCED = "Content-Security-Policy";
const REPORT_ONLY = "Content-Security-Policy-Report-Only";

async function headersFor(nodeEnv: "production" | "development" | "test") {
  vi.stubEnv("NODE_ENV", nodeEnv);
  const rules = await nextConfig.headers!();
  return rules.find((rule) => rule.source === "/:path*")!.headers;
}

/** The single CSP header of the build (asserts there is exactly one, under either name). */
async function cspFor(nodeEnv: "production" | "development" | "test") {
  const csp = (await headersFor(nodeEnv)).filter((header) => header.key === ENFORCED || header.key === REPORT_ONLY);
  expect(csp).toHaveLength(1);
  const directives = csp[0].value.split("; ");
  const directive = (name: string) => directives.find((part) => part.startsWith(`${name} `))!.split(" ").slice(1);
  return { name: csp[0].key, value: csp[0].value, directives, directive };
}

const ALL_ENVS = ["production", "development", "test"] as const;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("next.config security headers", () => {
  it("does not advertise the framework", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it("enforces the CSP in production builds, without 'unsafe-eval'", async () => {
    const csp = await cspFor("production");
    expect(csp.name).toBe(ENFORCED);
    expect(csp.directive("script-src")).toEqual(["'self'", "'unsafe-inline'", "https://challenges.cloudflare.com"]);
    expect(csp.value).not.toContain("'unsafe-eval'");
  });

  it.each(["development", "test"] as const)("keeps the CSP report-only with 'unsafe-eval' outside production (%s)", async (nodeEnv) => {
    const csp = await cspFor(nodeEnv);
    expect(csp.name).toBe(REPORT_ONLY);
    expect(csp.directive("script-src")).toEqual(["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://challenges.cloudflare.com"]);
  });

  it.each(ALL_ENVS)("sends the same lock-down directives in every env (%s)", async (nodeEnv) => {
    const csp = await cspFor(nodeEnv);
    expect(csp.directives).toEqual(
      expect.arrayContaining([
        "default-src 'self'",
        "object-src 'none'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: blob: https:",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ]),
    );
    expect(csp.directives).toHaveLength(11);
  });

  it("differs between production and dev only in the header name and 'unsafe-eval'", async () => {
    const prod = await cspFor("production");
    const dev = await cspFor("development");
    expect(dev.value.replace(" 'unsafe-eval'", "")).toBe(prod.value);
  });

  it.each(ALL_ENVS)("lets the Cloudflare Turnstile script, challenge iframe and fetches through (%s)", async (nodeEnv) => {
    const csp = await cspFor(nodeEnv);
    for (const name of ["script-src", "frame-src", "connect-src"]) {
      expect(csp.directive(name)).toContain("https://challenges.cloudflare.com");
    }
  });

  it.each(ALL_ENVS)("allows the Injective JSON-RPC that viem's http transport calls (%s)", async (nodeEnv) => {
    const connect = (await cspFor(nodeEnv)).directive("connect-src");
    expect(connect).toEqual(expect.arrayContaining(["'self'", "https://*.injective.network", "wss://*.injective.network"]));
  });

  it.each(ALL_ENVS)("keeps the WalletConnect/RainbowKit origins out and only frames Turnstile (wagmi 3 is injected-only) (%s)", async (nodeEnv) => {
    const csp = await cspFor(nodeEnv);
    expect(csp.value).not.toMatch(/walletconnect|web3modal|rainbow\.me/);
    expect(csp.directives).toContain("frame-src https://challenges.cloudflare.com");
  });

  describe("Vercel preview toolbar", () => {
    const DIRECTIVES = ["script-src", "connect-src", "img-src", "frame-src", "style-src", "font-src"];

    it("allows vercel.live only when VERCEL_ENV=preview", async () => {
      vi.stubEnv("VERCEL_ENV", "preview");
      const csp = await cspFor("production");
      for (const name of DIRECTIVES) expect(csp.directive(name)).toContain("https://vercel.live");
      expect(csp.directive("connect-src")).toContain("wss://ws-us3.pusher.com");
    });

    it.each(["production", "development", ""])("keeps vercel.live out when VERCEL_ENV=%j", async (vercelEnv) => {
      vi.stubEnv("VERCEL_ENV", vercelEnv);
      const csp = await cspFor("production");
      expect(csp.value).not.toMatch(/vercel\.live|pusher/);
    });
  });

  describe("configured JSON-RPC origin", () => {
    it.each(ALL_ENVS)("adds the NEXT_PUBLIC_INJECTIVE_EVM_RPC_URL origin to connect-src (%s)", async (nodeEnv) => {
      vi.stubEnv("NEXT_PUBLIC_INJECTIVE_EVM_RPC_URL", "https://rpc.example.com/path?k=1");
      expect((await cspFor(nodeEnv)).directive("connect-src")).toContain("https://rpc.example.com");
    });

    it("adds nothing when the variable is unset or not https", async () => {
      vi.stubEnv("NEXT_PUBLIC_INJECTIVE_EVM_RPC_URL", "http://rpc.example.com");
      expect((await cspFor("production")).value).not.toContain("rpc.example.com");
    });
  });
});
