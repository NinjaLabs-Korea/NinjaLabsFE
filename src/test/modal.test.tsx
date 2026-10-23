// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { useState } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
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
