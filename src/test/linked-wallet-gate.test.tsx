// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { LinkedWalletGate } from "@/components/signup/LinkedWalletGate";
import { renderWithIntl } from "@/test/intl";
import { loading, signedInWith, signedOut } from "@/test/support/auth";

const state = vi.hoisted(() => ({ auth: null as unknown }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: ComponentProps<"a">) => <a href={href} {...props}>{children}</a>,
}));
vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({ useAuthSnapshot: () => state.auth }));

const gate = () => renderWithIntl(<LinkedWalletGate><button type="button">Verify wallet</button></LinkedWalletGate>);

describe("LinkedWalletGate (signup step 2)", () => {
  it("shows the linked wallet read-only with a way on, never the Verify action", () => {
    state.auth = signedInWith({ walletAddress: "0xF507aBc0000000000000000000000000000c6E6", onboardingStep: 3, onboardingCompleted: false });
    gate();
    expect(screen.queryByRole("button", { name: "Verify wallet" })).toBeNull();
    expect(screen.getByTestId("linked-wallet-address").textContent).toBe("0xF507aBc0000000000000000000000000000c6E6");
    expect(screen.getByRole("link", { name: "Continue" }).getAttribute("href")).toBe("/signup/profile");
  });

  it.each([["no wallet", signedInWith({ onboardingStep: 2, onboardingCompleted: false })], ["signed out", signedOut], ["loading", loading]])(
    "keeps the connect UI for %s",
    (_name, snapshot) => {
      state.auth = snapshot;
      gate();
      expect(screen.getByRole("button", { name: "Verify wallet" })).toBeTruthy();
      expect(screen.queryByTestId("linked-wallet-address")).toBeNull();
    },
  );
});
