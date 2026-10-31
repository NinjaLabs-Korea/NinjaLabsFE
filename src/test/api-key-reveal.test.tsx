// @vitest-environment jsdom
import { fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiKeyReveal } from "@/components/agents/ApiKeyReveal";
import { renderWithIntl } from "@/test/intl";

const key = "nl_live_0123456789abcdefghijklmnopqrstuvwxyz01";

describe("ApiKeyReveal", () => {
  afterEach(() => {
    Reflect.deleteProperty(window.navigator, "clipboard");
  });

  it("shows the whole key in a wrapping read-only multi-line field, not a single-line input", () => {
    renderWithIntl(<ApiKeyReveal apiKey={key} copy="Shown once." expiresLabel="Expires soon" title="New API key issued" />);
    const field = screen.getByLabelText("New API key");
    expect(field.tagName).toBe("TEXTAREA");
    expect((field as HTMLTextAreaElement).value).toBe(key);
    expect((field as HTMLTextAreaElement).readOnly).toBe(true);
    expect(field.className).toContain("break-all");
    expect(field.className).not.toContain("truncate");
  });

  it("selects the key on focus and copies the exact key", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(window.navigator, "clipboard", { configurable: true, value: { writeText } });
    renderWithIntl(<ApiKeyReveal apiKey={key} copy="Shown once." expiresLabel="Expires soon" title="New API key issued" />);
    const field = screen.getByLabelText("New API key") as HTMLTextAreaElement;
    fireEvent.focus(field);
    expect(field.selectionEnd - field.selectionStart).toBe(key.length);
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await screen.findByText("API key copied to the clipboard.");
    expect(writeText).toHaveBeenCalledWith(key);
  });
});
