// @vitest-environment jsdom
import { act, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminToastHost, pushAdminToast } from "@/components/admin/AdminToastHost";
import { renderWithIntl } from "@/test/intl";

describe("AdminToastHost", () => {
  it("announces non-danger toasts through a persistent polite region and keeps role=alert for danger", () => {
    renderWithIntl(<AdminToastHost />);
    const region = document.querySelector("[aria-live=\"polite\"]") as HTMLElement;
    expect(region).toBeTruthy();
    expect(region.textContent).toBe("");

    act(() => pushAdminToast({ variant: "success", title: "Saved", description: "Bounty updated." }));
    expect(region.textContent).toBe("Saved. Bounty updated.");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();

    act(() => pushAdminToast({ variant: "danger", title: "Failed", description: "Try again." }));
    expect(screen.getByRole("alert").textContent).toContain("Failed");
    expect(region.textContent).toBe("Saved. Bounty updated.");
  });

  it("animates each toast in", () => {
    renderWithIntl(<AdminToastHost />);
    act(() => pushAdminToast({ variant: "success", title: "Saved", description: "Done." }));
    const item = screen.getByText("Saved").closest("div.flex") as HTMLElement;
    expect(item.className).toContain("animate-toast-in");
    expect(item.className).toContain("motion-reduce:animate-none");
  });

  it("re-announces an identical consecutive toast by replacing the live node (keyed by toast id)", () => {
    renderWithIntl(<AdminToastHost />);
    const region = document.querySelector("[aria-live=\"polite\"]") as HTMLElement;
    act(() => pushAdminToast({ variant: "success", title: "Saved", description: "Bounty updated." }));
    const first = region.firstElementChild;
    expect(first?.textContent).toBe("Saved. Bounty updated.");

    act(() => pushAdminToast({ variant: "success", title: "Saved", description: "Bounty updated." }));
    const second = region.firstElementChild;
    expect(second?.textContent).toBe("Saved. Bounty updated.");
    // Same text, new DOM node: assistive tech reports the addition instead of ignoring unchanged text.
    expect(second).not.toBe(first);
    expect(first?.isConnected).toBe(false);
    expect(region.childElementCount).toBe(1);
  });
});
