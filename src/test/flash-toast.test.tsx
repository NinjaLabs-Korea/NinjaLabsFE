// @vitest-environment jsdom
import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FLASH_TOAST_MS, FlashToast } from "@/components/layout/FlashToast";
import { pushFlash } from "@/lib/flash";
import { renderWithIntl } from "@/test/intl";

const toast = () => screen.queryByText("Profile saved", { selector: "p" });

describe("FlashToast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.sessionStorage.clear();
    renderWithIntl(<FlashToast />);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    act(() => pushFlash("profileSaved"));
  });
  afterEach(() => vi.useRealTimers());

  it("dismisses itself after the flash duration", () => {
    expect(toast()).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(FLASH_TOAST_MS - 1);
    });
    expect(toast()).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(toast()).toBeNull();
  });

  it("stays while the pointer is over it and dismisses with the remaining time after leaving", () => {
    const wrapper = toast()!.closest("div.fixed")!;
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    fireEvent.pointerEnter(wrapper);
    act(() => {
      vi.advanceTimersByTime(FLASH_TOAST_MS * 2);
    });
    expect(toast()).toBeTruthy();
    fireEvent.pointerLeave(wrapper);
    act(() => {
      vi.advanceTimersByTime(FLASH_TOAST_MS - 2000 - 1);
    });
    expect(toast()).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(toast()).toBeNull();
  });

  it("stays while focus is inside and resumes when focus leaves", () => {
    const wrapper = toast()!.closest("div.fixed")!;
    const dismiss = screen.getByRole("button", { name: "Dismiss" });
    fireEvent.focusIn(dismiss);
    act(() => {
      vi.advanceTimersByTime(FLASH_TOAST_MS * 2);
    });
    expect(toast()).toBeTruthy();
    fireEvent.focusOut(dismiss, { relatedTarget: document.body });
    expect(wrapper.isConnected).toBe(true);
    act(() => {
      vi.advanceTimersByTime(FLASH_TOAST_MS);
    });
    expect(toast()).toBeNull();
  });
});
