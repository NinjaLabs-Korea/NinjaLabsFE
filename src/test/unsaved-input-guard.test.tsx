// @vitest-environment jsdom
import { fireEvent, render } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { useUnsavedInputGuard } from "@/components/layout/useUnsavedInputGuard";

vi.mock("@/i18n/navigation", () => ({ usePathname: () => "/recruit" }));

const probe: { has: () => boolean } = { has: () => false };
function Probe() {
  const { hasUnsavedInput } = useUnsavedInputGuard();
  useEffect(() => {
    probe.has = hasUnsavedInput;
  });
  return null;
}
const has = () => probe.has();

function setup(inner: string, inMain = true) {
  const { container } = render(
    <>
      <Probe />
      <div dangerouslySetInnerHTML={{ __html: inMain ? `<main id="main-content">${inner}</main>` : inner }} />
    </>,
  );
  return container;
}

describe("useUnsavedInputGuard", () => {
  it("treats a touched radio as unsaved", () => {
    const c = setup('<form><input type="radio" name="a" value="x" /></form>');
    expect(has()).toBe(false);
    fireEvent.input(c.querySelector("input")!);
    expect(has()).toBe(true);
  });

  it("treats a touched checkbox as unsaved", () => {
    const c = setup('<form><input type="checkbox" /></form>');
    fireEvent.input(c.querySelector("input")!);
    expect(has()).toBe(true);
  });

  it("ignores fields outside a form", () => {
    const c = setup('<input type="text" />');
    const input = c.querySelector("input")!;
    input.value = "abc";
    fireEvent.input(input);
    expect(has()).toBe(false);
  });

  it("tracks a text field inside an editor form and clears on submit", () => {
    const c = setup('<form><input type="text" /></form>');
    const input = c.querySelector("input")!;
    input.value = "abc";
    fireEvent.input(input);
    expect(has()).toBe(true);
    fireEvent.submit(c.querySelector("form")!);
    expect(has()).toBe(false);
  });
});
