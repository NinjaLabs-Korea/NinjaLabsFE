// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { scrollIntoViewRespectingMotion } from "@/lib/scroll";

const element = () => ({ scrollIntoView: vi.fn() }) as unknown as Element & { scrollIntoView: ReturnType<typeof vi.fn> };
const mockMatchMedia = (matches: boolean) => vi.stubGlobal("matchMedia", vi.fn(() => ({ matches })));

afterEach(() => vi.unstubAllGlobals());

describe("scrollIntoViewRespectingMotion", () => {
  it("jumps instantly when reduced motion is requested", () => {
    mockMatchMedia(true);
    const el = element();
    scrollIntoViewRespectingMotion(el, { block: "start" });
    expect(el.scrollIntoView).toHaveBeenCalledWith({ block: "start", behavior: "auto" });
  });

  it("scrolls smoothly otherwise", () => {
    mockMatchMedia(false);
    const el = element();
    scrollIntoViewRespectingMotion(el);
    expect(el.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth" });
  });

  it("falls back to smooth when matchMedia is missing", () => {
    vi.stubGlobal("matchMedia", undefined);
    const el = element();
    expect(() => scrollIntoViewRespectingMotion(el)).not.toThrow();
    expect(el.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth" });
  });

  it("ignores a missing element", () => {
    expect(() => scrollIntoViewRespectingMotion(null)).not.toThrow();
  });
});
