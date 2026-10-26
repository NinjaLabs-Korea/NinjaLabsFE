import { describe, expect, it } from "vitest";
import { buildAgentSkillMarkdown } from "@/lib/agent-skill";

describe("agent skill markdown", () => {
  it("points agents at the configured API base URL without a double slash", () => {
    const markdown = buildAgentSkillMarkdown("https://api.example.test/");
    expect(markdown).toContain("`https://api.example.test/agent-api/v1`");
    expect(markdown).not.toContain("example.test//");
  });

  it("falls back to a placeholder host when no API URL is configured", () => {
    expect(buildAgentSkillMarkdown(undefined)).toContain("https://<ninja-labs-api-host>/agent-api/v1");
  });

  // Mirrors NinjaLabsBE docs/agent-api.md + agent-api.controller.ts DTOs + agent-api-throttler.guard.ts.
  // When the BE contract moves, this test fails first; update lib/agent-skill.ts together with it.
  describe("stays in sync with the BE agent API contract", () => {
    const markdown = buildAgentSkillMarkdown("https://api.example.test");

    it("documents the per-key rate limit and the throttler's named headers", () => {
      expect(markdown).toContain("60 requests per minute per API key");
      expect(markdown).toContain("429 Too Many Requests");
      expect(markdown).toContain("`Retry-After-agent-api`");
      // A 429 from the key bucket also carries the unsuffixed per-IP X-RateLimit-* headers (they can show quota left): the guide says to ignore them.
      expect(markdown).toContain("sends `Retry-After-agent-api`");
      expect(markdown).toContain("belong to the per-IP limit");
      expect(markdown).not.toContain("without the `X-RateLimit-*` headers");
      expect(markdown).not.toContain("global 120/min per-IP");
      expect(markdown).toContain("`X-RateLimit-Limit-agent-api`");
      expect(markdown).toContain("`X-RateLimit-Remaining-agent-api`");
      expect(markdown).toContain("`X-RateLimit-Reset-agent-api`");
    });

    it("describes the IP limit as per route, not global (BE docs/agent-api.md)", () => {
      expect(markdown).toContain("per-IP limit of 120 per minute per route");
      expect(markdown).not.toContain("global 120/min");
    });

    it("does not promise a VALIDATION_FAILED code the BE never sends (Nest returns message[] with a plain 400)", () => {
      expect(markdown).not.toContain("VALIDATION_FAILED");
      expect(markdown).toContain("`message` array");
    });

    it("documents the DTO caps and the http(s)-only URL rule", () => {
      expect(markdown).toContain("`message`: required, at most 4000 characters.");
      expect(markdown).toContain("`description`: required, at most 8000 characters.");
      expect(markdown).toContain("`commitSha`: optional, at most 64 characters.");
      for (const field of ["portfolioUrl", "submissionUrl", "repositoryUrl"]) {
        expect(markdown).toMatch(new RegExp(`\\x60${field}\\x60: (required|optional), must be an \\x60http\\(s\\)://\\x60 URL\\.`));
      }
      expect(markdown).toContain("Only `http://` and `https://` URLs are accepted anywhere");
    });

    it.each([
      "MISSING_AGENT_API_KEY", "INVALID_AGENT_API_KEY", "BOUNTY_NOT_OPEN", "ALREADY_APPLIED", "APPLICATION_NOT_APPROVED",
      "DEADLINE_PASSED", "APPLICATION_DEADLINE_PASSED", "SUBMISSION_FINALIZED", "DIRECT_SUBMISSION_REQUIRED",
      "BOUNTY_NOT_FOUND", "SUBMISSION_TYPE_BOUNTY",
    ])("lists the %s error code in the errors table", (code) => {
      expect(markdown).toMatch(new RegExp(`^\\| \\d{3} \\| \\x60${code}\\x60 \\|`, "m"));
    });

    it("does not list review-time codes the agent routes never return", () => {
      // MAX_WINNERS_REACHED is thrown when an operator approves a submission, not on POST /agent-api/v1/*.
      expect(markdown).not.toContain("MAX_WINNERS_REACHED");
    });

    it("names the list response shape and the bounty fields an agent filters on", () => {
      expect(markdown).toContain("`{ items, page, pageSize, total }`");
      for (const field of ["submission_mode", "application_required", "application_deadline", "submission_deadline"]) {
        expect(markdown).toContain(`\`${field}\``);
      }
      expect(markdown).toContain("`DEV`, `DESIGN`, `CONTENT` or `OTHER`");
    });

    it("documents re-applying after a withdrawal and the fixed rate-limit window", () => {
      expect(markdown).toContain("A withdrawn application is not a conflict: sending it again reopens the same row as pending.");
      expect(markdown).toContain("The window is fixed: it starts at the first request and lasts 60 seconds");
    });

    it("says EVM registration takes walletAddress only and mentions rotation/revocation", () => {
      expect(markdown).toContain("the registration takes `walletAddress` only");
      expect(markdown).not.toContain("Register the wallet public key");
      expect(markdown).toContain("`POST /agents/:id/keys/rotate`");
    });
  });
});
