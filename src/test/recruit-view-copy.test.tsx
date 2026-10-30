// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { RecruitView } from "@/components/recruit/RecruitView";
import { createMockApiClient } from "@/lib/mocks/api-client";
import { signedInWith } from "@/test/support/auth";
import { renderWithIntl } from "@/test/intl";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: Omit<ComponentProps<"a">, "href"> & { href: string }) => <a href={String(href)} {...props}>{children}</a>,
}));

const api = createMockApiClient();
vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({
    useAuthSnapshot: () => signedInWith({ onboardingCompleted: true }),
    useFoundationMode: () => "api" as const,
    useCohortApi: () => api,
    useAccountApi: () => api,
  }));

const locales = ["en", "ko", "zh"] as const;
const load = (locale: string) => JSON.parse(readFileSync(join(process.cwd(), "messages", locale, "recruit.json"), "utf8")) as Record<string, unknown>;
const lookup = (tree: unknown, path: string) => path.split(".").reduce<unknown>((node, key) => (node && typeof node === "object" ? (node as Record<string, unknown>)[key] : undefined), tree);

describe("RecruitView copy", () => {
  it("renders the form lead as a sentence, not a message key", async () => {
    const view = renderWithIntl(<RecruitView aboutSlot={null} />);
    expect(await screen.findByRole("button", { name: "Send application" })).toBeTruthy();
    expect(view.container.textContent).not.toMatch(/recruit\.form|form\.(lead|intro)/);
    expect(view.container.textContent).toContain("Tell us a bit about yourself");
  });

  it.each(locales)("every form.* string used as text in RecruitView resolves to a string in %s", (locale) => {
    const source = readFileSync(join(process.cwd(), "src/components/recruit/RecruitView.tsx"), "utf8");
    const keys = [...source.matchAll(/\bt\("(form\.[\w.]+)"\)/g)].map((match) => match[1]);
    expect(keys).toContain("form.lead");
    const messages = load(locale);
    for (const key of keys) expect(typeof lookup(messages, key), `${locale} ${key}`).toBe("string");
  });
});
