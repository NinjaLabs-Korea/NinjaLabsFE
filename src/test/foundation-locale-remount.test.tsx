// @vitest-environment jsdom
import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FoundationProvider, resetTabFoundationForTests, useAuthSnapshot } from "@/components/auth/FoundationProvider";
import { SESSION_PREVIEW_STORAGE_KEY } from "@/lib/foundation/auth-adapter";
import { previewUser } from "@/lib/mocks/fixtures";

const config = { mode: "mock", previewUser, mockSeed: "default" } as const;

function Status() {
  return <p data-testid="status">{useAuthSnapshot().status}</p>;
}

afterEach(() => {
  sessionStorage.clear();
  resetTabFoundationForTests();
});

describe("FoundationProvider across a locale switch", () => {
  it("keeps the restored session when the shell remounts instead of starting over as loading", async () => {
    sessionStorage.setItem(SESSION_PREVIEW_STORAGE_KEY, "signed-in");
    const first = render(<FoundationProvider config={config}><Status /></FoundationProvider>);
    await waitFor(() => expect(first.getByTestId("status").textContent).toBe("signed-in"));
    first.unmount();

    // The [locale] layout remounts: the very first client render must already be signed in (no loading placeholder frame).
    const second = render(<FoundationProvider config={config}><Status /></FoundationProvider>);
    expect(second.getByTestId("status").textContent).toBe("signed-in");
  });
});
