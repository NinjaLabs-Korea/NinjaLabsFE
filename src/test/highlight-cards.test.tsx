// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { AchievementsSection } from "@/components/community/AchievementsSection";
import type { RuntimeHallOfFame } from "@/lib/hall-of-fame";
import { renderWithIntl } from "@/test/intl";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

const hall: RuntimeHallOfFame = {
  stats: [],
  highlights: [
    { category: "Project", title: "Unlinked card", body: "b", href: null, image: null },
    { category: "Project", title: "Linked card", body: "b", href: "https://ok.test", image: null },
  ],
  milestones: [],
  partners: [],
};

describe("AchievementsSection highlight cards", () => {
  it("renders a highlight without a link as a non-link article", () => {
    renderWithIntl(<AchievementsSection hall={hall} locale="en" unavailable={false} />);
    const unlinked = screen.getByRole("heading", { name: "Unlinked card" });
    expect(unlinked.closest("a")).toBeNull();
    expect(unlinked.closest("article")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Linked card" }).closest("a")?.getAttribute("href")).toBe("https://ok.test");
  });
});
