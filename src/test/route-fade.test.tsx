// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ROUTE_LEAVING_TIMEOUT_MS, resetRouteFadeForTests, RouteFade } from "@/components/layout/RouteFade";

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
afterEach(() => {
  main.remove();
  document.querySelectorAll("a[data-test-link]").forEach((node) => node.remove());
  vi.useRealTimers();
});

const fading = () => main.classList.contains("animate-page-in") && main.classList.contains("motion-reduce:animate-none");

describe("RouteFade", () => {
  it("does not animate the tab's first page", () => {
    render(<RouteFade />);
    expect(fading()).toBe(false);
  });

  it("animates main after a client navigation and clears the class when the animation ends", () => {
    const view = render(<RouteFade />);
    pathname = "/bounties";
    view.rerender(<RouteFade />);
    expect(fading()).toBe(true);
    main.dispatchEvent(new Event("animationend"));
    expect(fading()).toBe(false);
  });

  it("animates a locale-switch remount (same tab, shell remounted)", () => {
    render(<RouteFade />).unmount();
    render(<RouteFade />);
    expect(fading()).toBe(true);
  });

  it("does not animate again when the pathname is unchanged (search-param or same-page updates)", () => {
    const view = render(<RouteFade />);
    view.rerender(<RouteFade />);
    expect(fading()).toBe(false);
  });

  it("enter class is added on a pathname change and removed on animationend", () => {
    const view = render(<RouteFade />);
    pathname = "/members";
    view.rerender(<RouteFade />);
    expect(main.className).toContain("animate-page-in");
    main.dispatchEvent(new Event("animationend"));
    expect(main.className).not.toContain("animate-page-in");
  });
});

const leaving = () => main.hasAttribute("data-route-leaving");

function link(href: string, attrs: Record<string, string> = {}) {
  const a = document.createElement("a");
  a.setAttribute("data-test-link", "");
  a.href = href;
  for (const [k, v] of Object.entries(attrs)) a.setAttribute(k, v);
  a.textContent = "x";
  // Next's Link would preventDefault and navigate on the client; jsdom must not try to navigate.
  a.addEventListener("click", (e) => e.preventDefault());
  document.body.appendChild(a);
  return a;
}

function click(el: Element, init: MouseEventInit = {}) {
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...init }));
  });
}

describe("RouteFade leaving feedback", () => {
  it("marks main as leaving on a plain click to an internal link with another pathname", () => {
    render(<RouteFade />);
    click(link("/ko/members"));
    expect(leaving()).toBe(true);
  });

  it.each([
    ["modifier (meta)", () => click(link("/ko/members"), { metaKey: true })],
    ["modifier (ctrl)", () => click(link("/ko/members"), { ctrlKey: true })],
    ["modifier (shift)", () => click(link("/ko/members"), { shiftKey: true })],
    ["modifier (alt)", () => click(link("/ko/members"), { altKey: true })],
    ["middle button", () => click(link("/ko/members"), { button: 1 })],
    ["external origin", () => click(link("https://example.com/ko/members"))],
    ["target=_blank", () => click(link("/ko/members", { target: "_blank" }))],
    ["download", () => click(link("/ko/members", { download: "" }))],
    ["hash only", () => click(link("#section"))],
    ["same path with a search change", () => click(link(`${window.location.pathname}?tag=a`))],
    ["a non-link element", () => click(document.body)],
  ])("does not mark leaving for %s", (_name, act1) => {
    render(<RouteFade />);
    act1();
    expect(leaving()).toBe(false);
  });

  it("is cleared when the pathname changes, and the enter animation starts", () => {
    const view = render(<RouteFade />);
    click(link("/ko/members"));
    expect(leaving()).toBe(true);
    pathname = "/members";
    view.rerender(<RouteFade />);
    expect(leaving()).toBe(false);
    expect(main.className).toContain("animate-page-in");
  });

  it("is cleared by the safety timeout when the navigation never lands", () => {
    vi.useFakeTimers();
    render(<RouteFade />);
    click(link("/ko/members"));
    act(() => {
      vi.advanceTimersByTime(ROUTE_LEAVING_TIMEOUT_MS - 1);
    });
    expect(leaving()).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(leaving()).toBe(false);
  });

  it("marks leaving on popstate to another path and ignores a hash-only popstate", () => {
    render(<RouteFade />);
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(leaving()).toBe(false);
    window.history.pushState({}, "", "/ko/bounties");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(leaving()).toBe(true);
    window.history.pushState({}, "", "/");
  });

  it("removes its listeners and the dim on unmount (locale switch remount does not stay dimmed)", () => {
    const view = render(<RouteFade />);
    click(link("/ko/members"));
    expect(leaving()).toBe(true);
    view.unmount();
    expect(leaving()).toBe(false);
    click(link("/ko/bounties"));
    expect(leaving()).toBe(false);
  });
});
