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
            <button {...menu.itemProps(index)} key={label} role="menuitem" type="button">
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

  it("closes on Escape and returns focus to the trigger", () => {
    render(<Menu />);
    const trigger = screen.getByRole("button", { name: "Open" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(item("One"), { key: "Escape" });
    expect(screen.queryByRole("menuitem")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
