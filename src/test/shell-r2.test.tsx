// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";
import { useUnsavedInputGuard } from "@/components/layout/useUnsavedInputGuard";
import { renderWithIntl } from "@/test/intl";

const replace = vi.fn();
let mockPath = "/recruit";
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => mockPath,
  useRouter: () => ({ replace }),
}));

const read = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

describe("shell source contracts", () => {
  it("mobile nav has no second /bounties link (NavLinks already lists it)", () => {
    expect(read("src/components/layout/Header.tsx")).not.toContain('href="/bounties"');
  });
  it("footer contact container has a gap so label and email do not touch", () => {
    expect(read("src/components/layout/Footer.tsx")).toMatch(/inline-flex max-sm:min-h-11 flex-wrap items-center gap-x-1/);
  });
});

function Probe({ onReady }: { onReady: (fn: () => boolean) => void }) {
  onReady(useUnsavedInputGuard().hasUnsavedInput);
  return null;
}

function Page({ onReady }: { onReady: (fn: () => boolean) => void }) {
  return (
    <>
      <Probe onReady={onReady} />
      <main id="main-content">
        <form data-testid="form" onSubmit={(e) => e.preventDefault()}>
          <textarea aria-label="note" />
        </form>
        <div role="search">
          <form><input aria-label="q" type="search" /></form>
        </div>
      </main>
    </>
  );
}

describe("useUnsavedInputGuard", () => {
  it("tracks typed text, forgets on submit, ignores search inputs", () => {
    mockPath = "/recruit";
    let has = () => false;
    render(<Page onReady={(fn) => { has = fn; }} />);
    expect(has()).toBe(false);
    fireEvent.input(screen.getByLabelText("q"), { target: { value: "abc" } });
    expect(has()).toBe(false);
    fireEvent.input(screen.getByLabelText("note"), { target: { value: "hello" } });
    expect(has()).toBe(true);
    fireEvent.submit(screen.getByTestId("form"));
    expect(has()).toBe(false);
  });

  it("is exempt on /signup/profile", () => {
    mockPath = "/signup/profile";
    let has = () => false;
    render(<Page onReady={(fn) => { has = fn; }} />);
    fireEvent.input(screen.getByLabelText("note"), { target: { value: "hello" } });
    expect(has()).toBe(false);
  });
});

describe("LocaleSwitcher with typed text", () => {
  const pickKo = () => {
    fireEvent.click(screen.getByRole("button", { name: "Language" }));
    act(() => fireEvent.click(screen.getAllByRole("menuitemradio")[1]));
  };
  const setup = () => {
    mockPath = "/recruit";
    replace.mockClear();
    renderWithIntl(
      <main id="main-content">
        <form><textarea aria-label="note" /></form>
        <LocaleSwitcher />
      </main>,
    );
  };

  it("switches immediately when nothing was typed", () => {
    setup();
    pickKo();
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it("asks first when dirty; cancel keeps the page, confirm navigates", () => {
    setup();
    fireEvent.input(screen.getByLabelText("note"), { target: { value: "draft" } });
    pickKo();
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText("Switch language?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Keep editing", hidden: true }));
    expect(replace).not.toHaveBeenCalled();
    pickKo();
    act(() => fireEvent.click(screen.getByRole("button", { name: "Switch and clear", hidden: true })));
    expect(replace).toHaveBeenCalledWith("/recruit", { locale: "ko" });
  });
});
