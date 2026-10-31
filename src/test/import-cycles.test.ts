import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * No module under `src` (tests aside) may reach itself through its imports, type-only imports included. A cycle couples two
 * modules so neither can be read, tested or moved alone; the usual fix is a leaf module both import (`lib/api/unavailable.ts`,
 * the panel types in `components/admin/ops-ui.ts`).
 */
const SRC = join(process.cwd(), "src");

function files(dir = SRC): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "test" ? [] : files(path);
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts") ? [path] : [];
  });
}

function resolve(from: string, spec: string): string | null {
  const base = spec.startsWith("@/") ? join(SRC, spec.slice(2)) : spec.startsWith(".") ? join(dirname(from), spec) : null;
  if (!base) return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (/\.(ts|tsx)$/.test(candidate) && existsSync(candidate)) return candidate;
  }
  return null;
}

function graph(): Map<string, string[]> {
  const edges = new Map<string, string[]>();
  for (const file of files()) {
    const source = readFileSync(file, "utf8");
    const specs = [...source.matchAll(/(?:import|export)\s[^"';]*?from\s+["']([^"']+)["']/g)].map((match) => match[1]);
    edges.set(file, specs.map((spec) => resolve(file, spec)).filter((target): target is string => target !== null));
  }
  return edges;
}

function cycles(edges: Map<string, string[]>): string[][] {
  const found: string[][] = [];
  const state = new Map<string, "open" | "done">();
  const stack: string[] = [];
  const visit = (node: string) => {
    state.set(node, "open");
    stack.push(node);
    for (const next of edges.get(node) ?? []) {
      if (state.get(next) === "open") found.push([...stack.slice(stack.indexOf(next)), next]);
      else if (!state.has(next)) visit(next);
    }
    stack.pop();
    state.set(node, "done");
  };
  for (const node of edges.keys()) if (!state.has(node)) visit(node);
  return found.map((cycle) => cycle.map((file) => relative(SRC, file).split(sep).join("/")));
}

describe("import graph", () => {
  it("has no cycles", () => {
    expect(cycles(graph())).toEqual([]);
  });
});
