import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// WCAG 1.4.3: the text tokens that carry real copy must reach 4.5:1 on the surfaces they are drawn on. The Figma
// values for muted/warning text were ~3.7:1 and ~4.1:1, so these are the darkened (muted: lightened on dark) variants.
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

function token(name: string): string {
  const match = new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  if (!match) throw new Error(`token --color-${name} not found in globals.css`);
  return match[1];
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

const AA = 4.5;

describe("text color tokens meet WCAG AA", () => {
  it.each([
    ["ink-muted", "surface"],
    ["ink-muted", "page"],
    ["ink-muted", "surface-subtle"],
    ["on-inverse-muted", "inverse-surface"],
    ["on-inverse-secondary", "inverse-surface"],
    ["warning", "warning-soft"],
    ["warning", "surface"],
    ["success", "success-soft"],
    ["danger", "danger-soft"],
    ["primary-strong", "primary-soft"],
  ])("%s on %s", (foreground, background) => {
    expect(contrast(token(foreground), token(background))).toBeGreaterThanOrEqual(AA);
  });
});

describe("motion tokens", () => {
  it.each(["--motion-fast", "--motion-base", "--motion-slow", "--ease-out-soft", "--animate-fade-in", "--animate-pop-in", "--animate-toast-in", "--animate-nav-progress"])("defines %s", (name) => {
    expect(css).toContain(`${name}:`);
  });
  it.each(["motion-control", "motion-press", "spinner"])("defines the @utility %s", (name) => {
    expect(css).toContain(`@utility ${name}`);
  });
  it("has a prefers-reduced-motion safety net", () => {
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
