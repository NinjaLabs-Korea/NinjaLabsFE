// @vitest-environment node
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FoundationProvider, useAuthSnapshot } from "@/components/auth/FoundationProvider";
import { previewUser } from "@/lib/mocks/fixtures";

function Status() {
  return <p>{useAuthSnapshot().status}</p>;
}

describe("FoundationProvider on the server", () => {
  it("renders auth as loading and builds a fresh foundation per request", () => {
    const config = { mode: "mock", previewUser, mockSeed: "default" } as const;
    expect(typeof window).toBe("undefined");
    expect(renderToString(<FoundationProvider config={config}><Status /></FoundationProvider>)).toContain("loading");
  });
});
