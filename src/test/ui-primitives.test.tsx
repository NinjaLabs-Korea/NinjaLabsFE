// @vitest-environment jsdom
import { fireEvent, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Markdown } from "@/components/ui/Markdown";
import { RewardPill, isRewardUnset } from "@/components/ui/RewardPill";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { Toast } from "@/components/ui/Toast";
import { renderWithIntl } from "@/test/intl";

beforeAll(() => {
  // jsdom has no <dialog> implementation: only the open/close bookkeeping is needed.
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); };
});

describe("ConfirmDialog", () => {
  const renderDialog = (props: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    renderWithIntl(
      <ConfirmDialog
        confirmLabel="Revoke"
        description="The agent loses access immediately."
        eyebrow="Danger zone"
        onCancel={onCancel}
        onConfirm={onConfirm}
        open
        title="Revoke agent?"
        {...props}
      />,
    );
    return { onCancel, onConfirm };
  };

  it("names the dialog by its title and describes it by the description", () => {
    renderDialog();
    const dialog = screen.getByRole("dialog", { name: "Revoke agent?" });
    expect(dialog.hasAttribute("open")).toBe(true);
    const describedBy = dialog.getAttribute("aria-describedby");
    expect(describedBy && document.getElementById(describedBy)?.textContent).toBe("The agent loses access immediately.");
  });

  it("is an alertdialog with the callout when destructive", () => {
    renderDialog({ destructive: true, calloutText: "This cannot be undone." });
    expect(screen.getByRole("alertdialog", { name: "Revoke agent?" })).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("This cannot be undone.")).toBeTruthy();
  });

  it("omits the callout when none is given", () => {
    renderDialog();
    expect(screen.queryByText("This cannot be undone.")).toBeNull();
  });

  it("calls onConfirm from the confirm button and onCancel from the localized Cancel button", () => {
    const { onCancel, onConfirm } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("routes Escape (the dialog cancel event) to onCancel instead of letting the browser close it", () => {
    const { onCancel, onConfirm } = renderDialog();
    const dialog = screen.getByRole("dialog");
    const event = new Event("cancel", { cancelable: true });
    dialog.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(dialog.hasAttribute("open")).toBe(true);
  });

  it("closes on a backdrop click but not on a click inside the panel", () => {
    const { onCancel } = renderDialog();
    const dialog = screen.getByRole("dialog");
    dialog.getBoundingClientRect = () => ({ left: 100, right: 300, top: 100, bottom: 300, width: 200, height: 200, x: 100, y: 100, toJSON: () => ({}) });
    fireEvent.click(dialog, { clientX: 150, clientY: 150 });
    fireEvent.click(screen.getByText("Revoke agent?"), { clientX: 10, clientY: 10 });
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.click(dialog, { clientX: 10, clientY: 10 });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe("Toast", () => {
  it("shrinks to its container on narrow screens instead of overflowing the viewport", () => {
    renderWithIntl(<Toast onDismiss={() => undefined} title="Saved" variant="success" />);
    expect(screen.getByText("Saved").closest("div[class*='w-[340px]']")?.className).toContain("max-w-full");
  });

  it("interrupts (role=alert) only for danger toasts", () => {
    const { unmount } = renderWithIntl(<Toast onDismiss={() => undefined} title="Revoke failed" variant="danger" />);
    expect(screen.getByRole("alert").textContent).toContain("Revoke failed");
    unmount();
    for (const variant of ["success", "warning", "info"] as const) {
      const view = renderWithIntl(<Toast onDismiss={() => undefined} title={`t-${variant}`} variant={variant} />);
      expect(screen.getByText(`t-${variant}`)).toBeTruthy();
      expect(screen.queryByRole("alert")).toBeNull();
      view.unmount();
    }
  });

  it("renders the action only when both a label and a handler exist, and dismisses through a labelled button", () => {
    const onAction = vi.fn();
    const onDismiss = vi.fn();
    const { rerender } = renderWithIntl(
      <Toast actionLabel="Undo" description="Saved 3 rows" onAction={onAction} onDismiss={onDismiss} title="Saved" variant="success" />,
    );
    expect(screen.getByText("Saved 3 rows")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onAction).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);

    rerender(<Toast actionLabel="Undo" onDismiss={onDismiss} title="Saved" variant="success" />);
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    expect(screen.queryByText("Saved 3 rows")).toBeNull();
  });
});

describe("Markdown allowlist", () => {
  const renderMd = (source: string) => renderWithIntl(<Markdown>{source}</Markdown>);

  it("strips javascript: (and other script-capable) link targets but keeps the link text", () => {
    renderMd("[click](javascript:alert(1)) and [data](data:text/html;base64,PHNjcmlwdD4=) and [vb](vbscript:msgbox)");
    expect(screen.getByText("click")).toBeTruthy();
    for (const anchor of Array.from(document.querySelectorAll("a"))) {
      const href = anchor.getAttribute("href") ?? "";
      expect(href).not.toMatch(/^\s*(javascript|data|vbscript):/i);
    }
  });

  it("opens absolute and protocol-relative links in a new tab with noreferrer, keeps relative links in-tab", () => {
    renderMd("[ext](https://injective.com) [proto](//example.com/x) [rel](/bounties/abc)");
    const ext = screen.getByRole("link", { name: "ext" });
    expect(ext.getAttribute("href")).toBe("https://injective.com");
    expect(ext.getAttribute("target")).toBe("_blank");
    expect(ext.getAttribute("rel")).toBe("noreferrer");
    expect(screen.getByRole("link", { name: "proto" }).getAttribute("target")).toBe("_blank");
    const rel = screen.getByRole("link", { name: "rel" });
    expect(rel.getAttribute("href")).toBe("/bounties/abc");
    expect(rel.getAttribute("target")).toBeNull();
    expect(rel.getAttribute("rel")).toBeNull();
  });

  it("does not render raw HTML, images, tables or h1 but keeps their text", () => {
    const { container } = renderMd(
      [
        "# Big title",
        "",
        "<script>window.__pwned = true</script><b>raw</b>",
        "",
        "![alt text](https://example.com/x.png)",
        "",
        "| a | b |",
        "|---|---|",
        "| cell1 | cell2 |",
      ].join("\n"),
    );
    expect(container.querySelector("script, img, table, h1, b")).toBeNull();
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();
    expect(container.textContent).toContain("Big title");
    expect(container.textContent).toContain("cell1");
  });

  it("renders the supported prose subset (h2/h3, lists, code, blockquote, strikethrough)", () => {
    const { container } = renderMd("## Scope\n\n### Detail\n\n- one\n- two\n\n1. first\n\n`inline`\n\n> quoted\n\n~~gone~~");
    expect(screen.getByRole("heading", { level: 2, name: "Scope" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 3, name: "Detail" })).toBeTruthy();
    expect(container.querySelectorAll("ul > li")).toHaveLength(2);
    expect(container.querySelector("ol > li")?.textContent).toBe("first");
    expect(container.querySelector("code")?.textContent).toBe("inline");
    expect(container.querySelector("blockquote")?.textContent?.trim()).toBe("quoted");
    expect(container.querySelector("del")?.textContent).toBe("gone");
  });
});

describe("RewardPill", () => {
  it("reads Reward TBD for an unset (0, negative, NaN) reward instead of 0 INJ", () => {
    for (const amount of [0, -5, Number.NaN]) {
      expect(isRewardUnset({ amount, currency: "INJ" })).toBe(true);
      const view = renderWithIntl(<RewardPill reward={{ amount, currency: "INJ" }} />);
      expect(screen.getByText("Reward TBD")).toBeTruthy();
      expect(screen.queryByText(/INJ/)).toBeNull();
      expect(view.container.querySelector("img")).toBeNull();
      view.unmount();
    }
  });

  it("keeps up to six fractional digits for small token amounts", () => {
    renderWithIntl(<RewardPill reward={{ amount: 0.000125, currency: "INJ" }} />);
    expect(screen.getByText("0.000125 INJ")).toBeTruthy();
  });

  it("icon variant renders the token glyph only when the reward is set", () => {
    const set = renderWithIntl(<RewardPill reward={{ amount: 10, currency: "USDC" }} variant="icon" />);
    expect(set.container.textContent).toBe("$");
    set.unmount();
    const unset = renderWithIntl(<RewardPill reward={{ amount: 0, currency: "USDC" }} variant="icon" />);
    expect(unset.container.textContent).toBe("");
  });
});

describe("StepIndicator", () => {
  it("lists the four onboarding steps in order and marks only the current one", () => {
    renderWithIntl(<StepIndicator current={3} />);
    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual(["1. Login", "2. Wallet + NFT", "3. Profile", "4. Get Started"]);
    expect(items.map((item) => item.getAttribute("aria-current"))).toEqual([null, null, "step", null]);
  });
});
