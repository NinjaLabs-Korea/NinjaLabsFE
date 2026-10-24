// @vitest-environment jsdom
import { act } from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FoundationProvider } from "@/components/auth/FoundationProvider";
import { BountyAccessBadges } from "@/components/bounties/BountyAccessBadges";
import { SESSION_PREVIEW_STORAGE_KEY } from "@/lib/foundation/auth-adapter";
import { previewUser } from "@/lib/mocks/fixtures";
import { IntlWrapper } from "@/test/intl";

const config = { mode: "mock", previewUser, mockSeed: "default" } as const;
const ui = (
  <IntlWrapper>
    <FoundationProvider config={config}>
      <BountyAccessBadges />
    </FoundationProvider>
  </IntlWrapper>
);

async function hydrate(): Promise<{ container: HTMLElement; recoverable: unknown[] }> {
  const container = document.createElement("div");
  container.innerHTML = renderToString(ui);
  const recoverable: unknown[] = [];
  await act(async () => {
    hydrateRoot(container, ui, { onRecoverableError: (error) => recoverable.push(error) });
  });
  return { container, recoverable };
}

afterEach(() => sessionStorage.clear());

describe("BountyAccessBadges", () => {
  it("server-renders the signed-out copy", () => {
    const html = renderToString(ui);
    expect(html).toContain("Public view");
    expect(html).toContain("Actions require login");
    expect(html).not.toContain("Signed in");
  });

  it("switches a restored signed-in session to the signed-in copy without a hydration mismatch", async () => {
    sessionStorage.setItem(SESSION_PREVIEW_STORAGE_KEY, "signed-in");
    const { container, recoverable } = await hydrate();
    await waitFor(() => expect(container.textContent).toContain("Signed in"));
    expect(container.textContent).toContain("Actions available");
    expect(container.textContent).not.toContain("Actions require login");
    expect(container.textContent).not.toContain("Public view");
    expect(recoverable).toEqual([]);
  });

  it("keeps the signed-out copy for a signed-out visitor", async () => {
    const { container, recoverable } = await hydrate();
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    expect(container.textContent).toContain("Actions require login");
    expect(recoverable).toEqual([]);
  });
});
