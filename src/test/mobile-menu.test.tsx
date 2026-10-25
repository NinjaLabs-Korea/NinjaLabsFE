// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MobileMenu } from "@/components/layout/MobileMenu";

function renderMenu() {
  render(
    <div>
      <button type="button">Outside</button>
      <MobileMenu label="Menu">
        <nav aria-label="Mobile navigation">
          <a href="https://example.test/bounties" onClick={(event) => event.preventDefault()}>Bounties</a>
          <button type="button">Sign out</button>
        </nav>
      </MobileMenu>
    </div>,
  );
  const details = document.querySelector("details") as HTMLDetailsElement;
  const open = () => act(() => {
    details.open = true;
    fireEvent(details, new Event("toggle"));
  });
  return { details, open };
}

describe("MobileMenu", () => {
  it("stays a plain <details> that opens through its summary", () => {
    const { details } = renderMenu();
    expect(details.open).toBe(false);
    expect(screen.getByText("Menu").tagName).toBe("SUMMARY");
  });

  it("closes on Escape and returns focus to the summary", () => {
    const { details, open } = renderMenu();
    open();
    expect(details.open).toBe(true);
    fireEvent.keyDown(screen.getByRole("link", { name: "Bounties" }), { key: "Escape" });
    expect(details.open).toBe(false);
    expect(document.activeElement).toBe(screen.getByText("Menu"));
  });

  it("closes on an outside click but not on a click inside", () => {
    const { details, open } = renderMenu();
    open();
    fireEvent.mouseDown(screen.getByRole("navigation", { name: "Mobile navigation" }));
    expect(details.open).toBe(true);
    fireEvent.mouseDown(screen.getByRole("button", { name: "Outside" }));
    expect(details.open).toBe(false);
  });

  it("closes when a link inside is clicked", () => {
    const { details, open } = renderMenu();
    open();
    fireEvent.click(screen.getByRole("link", { name: "Bounties" }));
    expect(details.open).toBe(false);
  });

  it("closes when a button inside is clicked (sign out must not leave the menu open)", () => {
    const { details, open } = renderMenu();
    open();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(details.open).toBe(false);
  });
});
