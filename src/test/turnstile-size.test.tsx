// @vitest-environment jsdom
import { act, cleanup, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TurnstileWidget } from "@/components/auth/TurnstileWidget";
import { resetTurnstileLoaderForTests, type TurnstileApi, type TurnstileRenderOptions } from "@/lib/turnstile";
import { renderWithIntl } from "@/test/intl";

let width = 230;
let resize: (() => void) | undefined;
const widgets: TurnstileRenderOptions[] = [];
const api = {
  render: vi.fn((_c: HTMLElement, options: TurnstileRenderOptions) => {
    widgets.push(options);
    return `w${widgets.length}`;
  }),
  reset: vi.fn(),
  remove: vi.fn(),
} satisfies TurnstileApi;

beforeEach(() => {
  widgets.length = 0;
  api.render.mockClear();
  api.remove.mockClear();
  resetTurnstileLoaderForTests();
  window.turnstile = api;
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => width);
  vi.stubGlobal("ResizeObserver", class {
    constructor(cb: () => void) { resize = cb; }
    observe() {}
    disconnect() {}
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  delete window.turnstile;
});

describe("TurnstileWidget size", () => {
  it("renders compact in a container narrower than 300px", async () => {
    width = 230;
    renderWithIntl(<TurnstileWidget onChange={vi.fn()} siteKey="k" />);
    await waitFor(() => expect(widgets).toHaveLength(1));
    expect(widgets[0]?.size).toBe("compact");
  });

  it("stays normal at 300px and wider", async () => {
    width = 312;
    renderWithIntl(<TurnstileWidget onChange={vi.fn()} siteKey="k" />);
    await waitFor(() => expect(widgets).toHaveLength(1));
    expect(widgets[0]?.size).toBe("normal");
  });

  it("re-renders when the container crosses 300px", async () => {
    width = 312;
    renderWithIntl(<TurnstileWidget onChange={vi.fn()} siteKey="k" />);
    await waitFor(() => expect(widgets).toHaveLength(1));
    width = 250;
    act(() => resize?.());
    await waitFor(() => expect(widgets).toHaveLength(2));
    expect(widgets[1]?.size).toBe("compact");
    expect(api.remove).toHaveBeenCalledWith("w1");
  });
});
