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
});
