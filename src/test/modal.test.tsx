// @vitest-environment jsdom
import { fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Modal } from "@/components/ui/Modal";

function Harness({ open }: { open: boolean }) {
  const [, rerender] = useState(0);
  return (
    <>
      <button onClick={() => rerender((count) => count + 1)} type="button">rerender</button>
      <button id="fallback" type="button">fallback</button>
      {/* Inline callback: a new function identity on every parent render. */}
      <Modal labelledBy="t" onClose={() => undefined} open={open} returnFocusTo={() => document.getElementById("fallback")}>
        <h2 id="t">Title</h2>
      </Modal>
    </>
  );
}

describe("Modal", () => {
  const showModal = vi.fn(function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); });
  const close = vi.fn(function close(this: HTMLDialogElement) { this.removeAttribute("open"); });
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = showModal;
    HTMLDialogElement.prototype.close = close;
  });

  afterEach(() => {
    showModal.mockClear();
    close.mockClear();
  });

  it("animates in with the open dialog and keeps the exit instant", () => {
    const { getByRole } = render(<Harness open />);
    const cls = getByRole("dialog", { hidden: true }).className;
    expect(cls).toContain("open:animate-pop-in");
    expect(cls).toContain("backdrop:animate-fade-in");
    expect(cls).toContain("motion-reduce:animate-none");
  });

  it("returns focus to the opener right after close", () => {
    function Opener() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)} type="button">opener</button>
          <Modal labelledBy="t2" onClose={() => setOpen(false)} open={open}>
            <h2 id="t2">T</h2>
            <button onClick={() => setOpen(false)} type="button">close</button>
          </Modal>
        </>
      );
    }
    const { getByText } = render(<Opener />);
    const opener = getByText("opener");
    opener.focus();
    fireEvent.click(opener);
    fireEvent.click(getByText("close"));
    expect(document.activeElement).toBe(opener);
  });

  it("does not re-run the open effect when an inline returnFocusTo callback changes identity", () => {
    const { getByText, rerender } = render(<Harness open />);
    expect(showModal).toHaveBeenCalledTimes(1);
    getByText("rerender").click();
    getByText("rerender").click();
    rerender(<Harness open />);
    expect(showModal).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();

    // Closing still uses the latest callback when the opener cannot take focus back (none was focused here).
    rerender(<Harness open={false} />);
    expect(close).toHaveBeenCalledTimes(1);
    expect(document.activeElement?.id).toBe("fallback");
  });
});

describe("Modal backdrop dismissal", () => {
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); };
  });

  function setup() {
    const onClose = vi.fn();
    const utils = render(
      <Modal labelledBy="t" onClose={onClose} open>
        <h2 id="t">Title</h2>
        <input aria-label="confirm" />
      </Modal>,
    );
    const dialog = utils.container.querySelector("dialog") as HTMLDialogElement;
    return { onClose, dialog, input: utils.getByLabelText("confirm") };
  }

  it("closes on a click that started and ended on the backdrop", () => {
    const { onClose, dialog } = setup();
    fireEvent.pointerDown(dialog);
    fireEvent.click(dialog, { clientX: -5, clientY: -5 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("stays open when a press inside the dialog is released on the backdrop", () => {
    const { onClose, dialog, input } = setup();
    fireEvent.pointerDown(input);
    // The browser targets the click at the common ancestor (the dialog) when the pointer is released outside the box.
    fireEvent.click(dialog, { clientX: -5, clientY: -5 });
    expect(onClose).not.toHaveBeenCalled();
  });
});
