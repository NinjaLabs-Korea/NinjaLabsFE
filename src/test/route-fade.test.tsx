// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetRouteFadeForTests, RouteFade } from "@/components/layout/RouteFade";

let pathname = "/";
vi.mock("@/i18n/navigation", () => ({ usePathname: () => pathname }));

let main: HTMLElement;
beforeEach(() => {
  resetRouteFadeForTests();
  pathname = "/";
  main = document.createElement("main");
  main.id = "main-content";
  document.body.appendChild(main);
});
afterEach(() => main.remove());

const fading = () => main.classList.contains("animate-fade-in") && main.classList.contains("motion-reduce:animate-none");

describe("RouteFade", () => {
  it("does not fade the tab's first page", () => {
    render(<RouteFade />);
    expect(fading()).toBe(false);
  });

  it("fades main after a client navigation and clears the class when the animation ends", () => {
    const view = render(<RouteFade />);
    pathname = "/bounties";
    view.rerender(<RouteFade />);
    expect(fading()).toBe(true);
    main.dispatchEvent(new Event("animationend"));
    expect(fading()).toBe(false);
  });

  it("fades a locale-switch remount (same tab, shell remounted)", () => {
    render(<RouteFade />).unmount();
    render(<RouteFade />);
    expect(fading()).toBe(true);
  });

  it("does not fade again when the pathname is unchanged (search-param or same-page updates)", () => {
    const view = render(<RouteFade />);
    view.rerender(<RouteFade />);
    expect(fading()).toBe(false);
  });
});
