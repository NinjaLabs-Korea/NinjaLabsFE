// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import { useEffect, useState } from "react";
import { describe, expect, it } from "vitest";
import { FoundationProvider, useAccountApi, useAuthSnapshot } from "@/components/auth/FoundationProvider";
import { pickMessages } from "@/i18n/messages";
import { renderWithIntl } from "@/test/intl";

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

describe("pickMessages", () => {
  it("returns only the requested namespaces and ignores unknown ones", () => {
    const messages = { common: { a: 1 }, bounties: { b: 2 }, admin: { c: 3 } };
    expect(pickMessages(messages, ["common", "bounties"])).toEqual({ common: { a: 1 }, bounties: { b: 2 } });
    expect(pickMessages({ common: { a: 1 } }, ["common", "signup"])).toEqual({ common: { a: 1 } });
  });
});
