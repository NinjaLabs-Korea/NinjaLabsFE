// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useMenuButton } from "@/components/layout/useMenuButton";

function Menu() {
  const menu = useMenuButton(3);
  return (
    <div {...menu.rootProps}>
      <button {...menu.buttonProps()}>Open</button>
      {menu.open ? (
        <div {...menu.menuProps}>
          {["One", "Two", "Three"].map((label, index) => (
            <button key={label} {...menu.itemProps(index)} role="menuitem" type="button">
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const item = (name: string) => screen.getByRole("menuitem", { name });

describe("useMenuButton", () => {
  it("moves focus into the menu when it opens", () => {
    render(<Menu />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Open" }), { key: "ArrowDown" });
    expect(document.activeElement).toBe(item("One"));
  });

  it("keeps keyboard navigation working after focus moves to another item without the keyboard", () => {
    render(<Menu />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Open" }), { key: "ArrowDown" });
    // e.g. a mouse focus: activeIndex was 0, real focus is now "Three".
    act(() => item("Three").focus());
    expect(item("Three").tabIndex).toBe(0);

    fireEvent.keyDown(item("Three"), { key: "Home" });
    expect(document.activeElement).toBe(item("One"));

    act(() => item("Three").focus());
    fireEvent.keyDown(item("Three"), { key: "ArrowUp" });
    expect(document.activeElement).toBe(item("Two"));
  });

  it("stays open through a blur with relatedTarget null (Safari/Firefox-macOS mousedown) so the following click lands", () => {
    render(<Menu />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Open" }), { key: "ArrowDown" });
    const two = item("Two");
    // Those browsers do not focus a button on mousedown: the root blurs with no relatedTarget before the click event.
    fireEvent.pointerDown(two);
    fireEvent.blur(item("One"), { relatedTarget: null });
    expect(screen.queryByRole("menuitem", { name: "Two" })).toBeTruthy();
    fireEvent.click(two);
    expect(screen.getByRole("menuitem", { name: "Two" })).toBe(two);
  });

  it("closes on an outside pointerdown and when focus moves to an element outside the menu", () => {
    render(
      <>
        <Menu />
        <button type="button">Elsewhere</button>
      </>,
    );
    fireEvent.keyDown(screen.getByRole("button", { name: "Open" }), { key: "ArrowDown" });
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menuitem")).toBeNull();

    fireEvent.keyDown(screen.getByRole("button", { name: "Open" }), { key: "ArrowDown" });
    fireEvent.blur(item("One"), { relatedTarget: screen.getByRole("button", { name: "Elsewhere" }) });
    expect(screen.queryByRole("menuitem")).toBeNull();
  });

  it("closes on Escape and returns focus to the trigger", () => {
    render(<Menu />);
    const trigger = screen.getByRole("button", { name: "Open" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(item("One"), { key: "Escape" });
    expect(screen.queryByRole("menuitem")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
