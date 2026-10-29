// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FoundationProvider, useAccountApi, useAuthActions, useAuthSnapshot } from "@/components/auth/FoundationProvider";
import { pickMessages } from "@/i18n/messages";
import { getSessionHint } from "@/lib/foundation/session-hint";
import { renderWithIntl } from "@/test/intl";
import { FakeBroadcastChannel } from "@/test/fake-broadcast-channel";

const previewUser = { id: "demo-user", handle: "demo", initials: "DU", profileSlug: "demo" };

function Probe() {
  const snapshot = useAuthSnapshot();
  const api = useAccountApi();
  const [agents, setAgents] = useState("pending");
  useEffect(() => {
    // Called while the mock client is still loading: it must wait for the real client instead of failing.
    void api.getAgents({ status: "signed-in", user: previewUser }).then((result) => setAgents(result.status));
  }, [api]);
  return <output>{snapshot.status}/{agents}</output>;
}

describe("FoundationProvider (mock mode)", () => {
  it("keeps the snapshot loading until the lazily imported mock modules are ready, then answers API calls", async () => {
    renderWithIntl(
      <FoundationProvider config={{ mode: "mock", previewUser, mockSeed: "default" }}>
        <Probe />
      </FoundationProvider>,
    );
    expect(screen.getByRole("status").textContent).toBe("loading/pending");
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("signed-out/available"));
  });
});

describe("FoundationProvider session hint", () => {
  afterEach(() => window.sessionStorage.clear());

  it("sets the tab's session hint on sign-in and clears it on sign-out", async () => {
        function Capture() {
      const { signIn, signOut } = useAuthActions();
      return (
        <>
          <output>{useAuthSnapshot().status}</output>
          <button onClick={() => void signIn()} type="button">in</button>
          <button onClick={() => void signOut()} type="button">out</button>
        </>
      );
    }
    renderWithIntl(
      <FoundationProvider config={{ mode: "mock", previewUser, mockSeed: "default" }}>
        <Capture />
      </FoundationProvider>,
    );
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("signed-out"));
    expect(getSessionHint()).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "in" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("signed-in"));
    expect(getSessionHint()).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "out" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("signed-out"));
    expect(getSessionHint()).toBe(false);
  });
});

describe("pickMessages", () => {
  it("returns only the requested namespaces and ignores unknown ones", () => {
    const messages = { common: { a: 1 }, bounties: { b: 2 }, admin: { c: 3 } };
    expect(pickMessages(messages, ["common", "bounties"])).toEqual({ common: { a: 1 }, bounties: { b: 2 } });
    expect(pickMessages({ common: { a: 1 } }, ["common", "signup"])).toEqual({ common: { a: 1 } });
  });
});

describe("useAuthSnapshot hydration", () => {
  afterEach(() => vi.unstubAllGlobals());

  function Status() {
    return <output>{useAuthSnapshot().status}</output>;
  }

  it("hydrates a late Suspense boundary against the server snapshot even after the session was restored", async () => {
    const { Suspense, lazy, act } = await import("react");
    const { renderToString } = await import("react-dom/server");
    const { hydrateRoot } = await import("react-dom/client");
    const config = { mode: "api", apiUrl: "https://api.example.test" } as const;
    localStorage.clear();
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    // Anonymous visitor (no session hint): the page load must not probe the auth proxy at all.
    const request = vi.fn(async (url: string) => new Response(url === "/api/auth/refresh" ? null : "unexpected", { status: 401 }));
    vi.stubGlobal("fetch", request);

    const container = document.createElement("div");
    container.innerHTML = renderToString(
      <FoundationProvider config={config}>
        <Suspense fallback={null}><Status /></Suspense>
      </FoundationProvider>,
    );
    expect(container.textContent).toBe("loading");

    // The streamed page body hydrates only after the provider's effect restored a (signed-out) session.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const LateStatus = lazy(async () => {
      await gate;
      return { default: Status };
    });
    const recoverable: unknown[] = [];
    await act(async () => {
      hydrateRoot(
        container,
        <FoundationProvider config={config}>
          <Suspense fallback={null}><LateStatus /></Suspense>
        </FoundationProvider>,
        { onRecoverableError: (error) => recoverable.push(error) },
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      release();
      await gate;
    });

    await waitFor(() => expect(container.textContent).toBe("signed-out"));
    expect(recoverable).toEqual([]);
    expect(request).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
  });
});
