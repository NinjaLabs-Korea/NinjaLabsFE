// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PageLoading } from "@/components/ui/PageLoading";
import { Skeleton } from "@/components/ui/Skeleton";

afterEach(cleanup);

describe("PageLoading", () => {
  it("is a status region named by the caller's label", () => {
    render(<PageLoading label="Loading your account…" />);
    expect(screen.getByRole("status").textContent).toBe("Loading your account…");
    expect(screen.getByRole("status").className).toContain("min-h-[60dvh]");
  });

  it("renders custom skeleton children instead of the default bars", () => {
    render(<PageLoading label="Loading" variant="detail"><div data-testid="custom" /></PageLoading>);
    expect(screen.getByTestId("custom")).toBeTruthy();
  });
});

describe("Skeleton", () => {
  it("is hidden from assistive tech and stops pulsing under reduced motion", () => {
    const { container } = render(<Skeleton className="h-4 rounded-control" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute("aria-hidden")).toBe("true");
    expect(el.className).toContain("animate-pulse");
    expect(el.className).toContain("motion-reduce:animate-none");
    expect(el.className).not.toContain("rounded-card");
  });
});
