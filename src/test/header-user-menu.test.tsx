// @vitest-environment jsdom
import { act, fireEvent, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Header } from "@/components/layout/Header";
import { NavLinks } from "@/components/layout/NavLinks";
import { UserMenu } from "@/components/layout/UserMenu";
import type { AuthSnapshot, ClientUser } from "@/lib/contracts/auth";
import { renderWithIntl } from "@/test/intl";
import { signedInAs } from "@/test/support/auth";

const nav = vi.hoisted(() => ({ pathname: "/" }));
const signOut = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("@/i18n/navigation", () => ({
  // `prefetch` is a next/link prop, not a DOM attribute.
  Link: ({ children, href, prefetch, ...props }: ComponentProps<"a"> & { prefetch?: boolean }) => (
    <a data-prefetch={prefetch ? "" : undefined} href={href} {...props}>
      {children}
    </a>
  ),
  usePathname: () => nav.pathname,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

const user: ClientUser = {
  id: "u1",
  handle: "jaemin.inj",
  initials: "JM",
  profileSlug: "jaemin",
  walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
};
const state: { auth: AuthSnapshot; mode: "mock" | "api" } = { auth: signedInAs(user), mode: "api" };

vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({
    useAuthSnapshot: () => state.auth,
    useAuthActions: () => ({ signOut }),
    useFoundationMode: () => state.mode,
  }));

const links = [
  { href: "/bounties", label: "Bounties" },
  { href: "/members", label: "Members" },
];

describe("NavLinks", () => {
  it("marks the link for the current section, including nested pages, with aria-current=page", () => {
    nav.pathname = "/bounties/abc";
    renderWithIntl(<NavLinks links={links} variant="desktop" />);
    expect(screen.getByRole("link", { name: "Bounties" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Members" }).getAttribute("aria-current")).toBeNull();
  });

  it.each(["desktop", "mobile"] as const)("gives the %s active link exactly one text color (same-property utilities are decided by stylesheet order)", (variant) => {
    nav.pathname = "/bounties";
    renderWithIntl(<NavLinks links={links} variant={variant} />);
    const textColors = (name: string) => (screen.getByRole("link", { name }).className.match(/(?:^|\s)text-(?!sm\b)[\w-]+/g) ?? []).map((token) => token.trim());
    expect(textColors("Bounties")).toEqual([variant === "desktop" ? "text-ink" : "text-primary-strong"]);
    expect(textColors("Members")).toEqual(["text-ink-secondary"]);
  });

  it("does not treat a shared prefix as the same section", () => {
    nav.pathname = "/members-archive";
    renderWithIntl(<NavLinks links={links} variant="mobile" />);
    expect(screen.getByRole("link", { name: "Members" }).getAttribute("aria-current")).toBeNull();
  });
});

describe("UserMenu", () => {
  beforeEach(() => {
    state.auth = signedInAs(user);
    state.mode = "api";
    signOut.mockClear();
  });

  const trigger = () => screen.getByRole("button", { name: /jaemin\.inj/ });

  it("renders nothing when signed out", () => {
    state.auth = { status: "signed-out", user: null };
    const { container } = renderWithIntl(<UserMenu />);
    expect(container.textContent).toBe("");
  });

  it("opens from the keyboard with focus on the first item and exposes the account links", () => {
    renderWithIntl(<UserMenu />);
    expect(trigger().getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.keyDown(trigger(), { key: "ArrowDown" });
    const menu = screen.getByRole("menu");
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    expect(trigger().getAttribute("aria-controls")).toBe(menu.id);
    // A menu role needs an accessible name (the locale menu has one too).
    expect(menu.getAttribute("aria-label")).toBe("Account navigation");

    const items = within(menu).getAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual(["My profile", "My applications", "My agents", "Account settings", "Sign out"]);
    expect(items.slice(0, 4).map((item) => item.getAttribute("href"))).toEqual(["/members/jaemin", "/applications", "/agents", "/account"]);
    expect(document.activeElement).toBe(items[0]);
    // Roving tabindex: only the active item is in the tab order.
    expect(items.map((item) => item.tabIndex)).toEqual([0, -1, -1, -1, -1]);
  });

  it("wraps arrow navigation, jumps with Home/End and closes on Escape with focus back on the trigger", () => {
    renderWithIntl(<UserMenu />);
    fireEvent.keyDown(trigger(), { key: "Enter" });
    const items = () => screen.getAllByRole("menuitem");

    fireEvent.keyDown(items()[0], { key: "ArrowUp" });
    expect(document.activeElement).toBe(items()[4]);
    fireEvent.keyDown(items()[4], { key: "ArrowDown" });
    expect(document.activeElement).toBe(items()[0]);
    fireEvent.keyDown(items()[0], { key: "End" });
    expect(document.activeElement?.textContent).toBe("Sign out");
    fireEvent.keyDown(items()[4], { key: "Home" });
    expect(document.activeElement?.textContent).toBe("My profile");

    fireEvent.keyDown(items()[0], { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it("closes on Tab without trapping focus", () => {
    renderWithIntl(<UserMenu />);
    fireEvent.keyDown(trigger(), { key: " " });
    fireEvent.keyDown(screen.getAllByRole("menuitem")[0], { key: "Tab" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("toggles with clicks and closes after following a link", () => {
    renderWithIntl(<UserMenu />);
    fireEvent.click(trigger());
    expect(screen.getByRole("menu")).toBeTruthy();
    fireEvent.click(trigger());
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole("menuitem", { name: "My applications" }));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("signs out from the menu and closes it", () => {
    renderWithIntl(<UserMenu />);
    fireEvent.click(trigger());
    act(() => fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" })));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("shows a shortened wallet visually but announces the full address", () => {
    renderWithIntl(<UserMenu />);
    fireEvent.click(trigger());
    const menu = screen.getByRole("menu");
    expect(within(menu).getByText("0x1234…5678").getAttribute("aria-hidden")).toBe("true");
    expect(within(menu).getByText(`Wallet address: ${user.walletAddress}`).className).toContain("sr-only");
    expect(within(menu).queryByText("Session preview")).toBeNull();
  });

  it("keeps a short wallet as-is and labels the mock session", () => {
    state.auth = signedInAs({ ...user, walletAddress: "inj1…9k4d" });
    state.mode = "mock";
    renderWithIntl(<UserMenu />);
    fireEvent.click(trigger());
    const menu = screen.getByRole("menu");
    expect(within(menu).getByText("inj1…9k4d")).toBeTruthy();
    expect(within(menu).getByText("Session preview")).toBeTruthy();
  });
});

describe("Header", () => {
  beforeEach(() => {
    nav.pathname = "/members/jaemin";
  });

  it("renders a home link, main and mobile navigation landmarks with the current section marked", () => {
    state.auth = { status: "signed-out", user: null };
    renderWithIntl(<Header />);
    expect(screen.getByRole("link", { name: "Ninja Labs home" }).getAttribute("href")).toBe("/");

    const main = screen.getByRole("navigation", { name: "Main navigation" });
    expect(within(main).getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Bounties", "/bounties"],
      ["Hall of Fame", "/hall-of-fame"],
      ["Members", "/members"],
      ["Notices", "/notices"],
    ]);
    expect(within(main).getByRole("link", { name: "Members" }).getAttribute("aria-current")).toBe("page");

    const mobile = screen.getByRole("navigation", { name: "Mobile navigation", hidden: true });
    expect(within(mobile).getAllByRole("link", { hidden: true }).map((link) => link.textContent)).toEqual([
      "Bounties", "Hall of Fame", "Members", "Notices", "Browse",
    ]);
  });

  it("offers Get Started to visitors and the account menu to signed-in users", () => {
    state.auth = { status: "signed-out", user: null };
    const view = renderWithIntl(<Header />);
    expect(screen.getByRole("link", { name: "Get Started" }).getAttribute("href")).toBe("/signup");
    expect(screen.queryByRole("button", { name: /jaemin\.inj/ })).toBeNull();
    view.unmount();

    state.auth = signedInAs(user);
    renderWithIntl(<Header />);
    expect(screen.queryByRole("link", { name: "Get Started" })).toBeNull();
    expect(screen.getByRole("button", { name: /jaemin\.inj/ }).getAttribute("aria-haspopup")).toBe("menu");
    expect(screen.getByRole("button", { name: "Language" })).toBeTruthy();
  });
});
