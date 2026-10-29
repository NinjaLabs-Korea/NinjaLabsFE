// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NavPendingBar } from "@/components/layout/NavLinks";

const status = vi.hoisted(() => ({ pending: false }));

vi.mock("next/link", async (importOriginal) => ({ ...(await importOriginal<object>()), useLinkStatus: () => status }));

describe("NavPendingBar", () => {
  beforeEach(() => {
    status.pending = false;
  });

  it("renders nothing while the link is idle", () => {
    const { container } = render(<NavPendingBar />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the decorative progress bar while the navigation is pending", () => {
    status.pending = true;
    const { container } = render(<NavPendingBar />);
    const bar = container.firstElementChild as HTMLElement;
    expect(bar.getAttribute("aria-hidden")).toBe("true");
    expect(bar.className).toContain("animate-nav-progress");
    expect(bar.className).toContain("motion-reduce:animate-none");
  });
});
