// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import BountyApplyPage from "@/app/[locale]/bounties/apply/page";
import { enMessages, renderWithIntl } from "@/test/intl";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: ComponentProps<"a">) => <a href={href} {...props}>{children}</a>,
}));
vi.mock("next-intl/server", () => ({
  setRequestLocale: () => undefined,
  getTranslations: async (options: string | { namespace: string }) => {
    const namespace = typeof options === "string" ? options : options.namespace;
    return createTranslator({ locale: "en", messages: enMessages, namespace: namespace as never, timeZone: "UTC" });
  },
}));
vi.mock("@/components/bounties/BountyApplyGuideCta", () => ({ BountyApplyGuideCta: () => <span>cta</span> }));

vi.mock("@/lib/bounties", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/bounties")>()),
  loadRuntimeBounties: vi.fn(async () => ({ bounties: [], unavailable: false })),
}));

describe("/bounties/apply guide page", () => {
  it("has one h1 and one name, no session strip and no button-behaviour boxes", async () => {
    const view = renderWithIntl(await BountyApplyPage({ params: Promise.resolve({ locale: "en" }) }));
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("How do I take part?");
    expect(view.container.textContent).not.toMatch(/Checking session|Signed in|Login required|Button behavior/i);
    expect(view.container.textContent).not.toMatch(/Submit-type|Apply-type/);
    expect(view.container.textContent?.match(/Apply → sponsor approval → submit → done/g)).toHaveLength(1);
  });
});
