// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge } from "@/components/ui/Badge";

// Regression: the landing hero badge ("Injective 기반") rendered its icon on a line of its own and the label was cut off at
// the bottom of the pill, because Tailwind preflight makes <img> display:block inside the truncating label span and the
// pill had a fixed height. The pill must keep icons inline with the label and must never have a fixed (clipping) height.
describe("Badge layout contract", () => {
  it("is an inline-flex, vertically centred, non-wrapping pill without a fixed height", () => {
    const { container } = render(<Badge>label</Badge>);
    const pill = container.firstElementChild as HTMLElement;
    const classes = pill.className.split(/\s+/);
    expect(classes).toEqual(expect.arrayContaining(["inline-flex", "items-center", "whitespace-nowrap", "min-h-6", "max-w-full"]));
    expect(classes.some((c) => /^h-\d/.test(c) || c.startsWith("h-["))).toBe(false);
  });

  it("keeps an icon child inline with the label (preflight makes img and svg block otherwise)", () => {
    const { container } = render(
      <Badge variant="inverse">
        <svg aria-hidden="true" />
        Injective
      </Badge>,
    );
    const label = container.querySelector("span span") as HTMLElement;
    const classes = label.className.split(/\s+/);
    expect(classes).toEqual(expect.arrayContaining(["[&_img]:inline", "[&_svg]:inline", "[&_img]:shrink-0", "[&_svg]:shrink-0", "truncate"]));
  });
});
