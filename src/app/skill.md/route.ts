import { buildAgentSkillMarkdown } from "@/lib/agent-skill";
import { loadRuntimeConfig } from "@/lib/runtime/config";

// GET /skill.md - 에이전트 등록 1단계의 다운로드 파일. 내용은 `lib/agent-skill.ts`.
export function GET() {
  const { apiUrl } = loadRuntimeConfig();
  return new Response(buildAgentSkillMarkdown(apiUrl), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": 'attachment; filename="skill.md"',
    },
  });
}
