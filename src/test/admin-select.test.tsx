// @vitest-environment jsdom
import { fireEvent, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { UserActions } from "@/components/admin/UserActions";
import { renderWithIntl } from "@/test/intl";

describe("AdminSelect", () => {
  it("labels the listbox with the combobox trigger", () => {
    renderWithIntl(<AdminSelect label="Type" onChange={vi.fn()} options={["MILESTONE", "PARTNERSHIP"]} value="MILESTONE" />);
    const trigger = screen.getByRole("combobox", { name: "Type" });
    fireEvent.click(trigger);
    const listbox = screen.getByRole("listbox", { name: "Type" });
    expect(listbox.getAttribute("aria-labelledby")).toBe(trigger.id);
    expect(trigger.id).not.toBe("");
    expect(trigger.getAttribute("aria-controls")).toBe(listbox.id);
  });
});

describe("AdminSelect with a long unbroken label", () => {
  // jsdom has no layout, so assert the classes that keep an unbroken title (a URL or hash) from widening the page:
  // the root may shrink below its content, the trigger text truncates and the option text wraps anywhere.
  it("lets the trigger shrink and truncate, and the options wrap", () => {
    const long = "x".repeat(150);
    const { container } = renderWithIntl(<AdminSelect formatOption={() => long} label="Bounty" onChange={vi.fn()} options={["a"]} value="a" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("min-w-0");
    expect(root.className).toContain("max-w-full");
    const label = screen.getByText(long);
    expect(label.className).toContain("truncate");
    expect(label.className).toContain("min-w-0");
    fireEvent.click(screen.getByRole("combobox", { name: "Bounty" }));
    expect(screen.getByRole("option").className).toContain("[overflow-wrap:anywhere]");
  });
});

describe("UserActions", () => {
  beforeAll(() => {
    // jsdom has no <dialog> implementation; Modal only needs open/close bookkeeping here.
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); };
  });

  it("exposes the role chips as a named group", () => {
    renderWithIntl(
      <UserActions
        onAssign={vi.fn()}
        onRemove={vi.fn()}
        user={{ slug: "ninja", nickname: "ninja", isMember: false, memberRole: null, memberDisplayOrder: null }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    const group = screen.getByRole("group", { name: "Member role" });
    expect(group.querySelectorAll("button[aria-pressed]").length).toBe(4);
  });
});
