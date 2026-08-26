// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect, type ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  FoundationProvider,
  useAuthActions,
  useAuthSnapshot,
} from "@/components/auth/FoundationProvider";
import { AuthArea } from "@/components/layout/AuthArea";
import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";
import { getOnboardingPath, shouldRedirectToOnboarding } from "@/lib/api/auth-adapter";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const routerPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));

const previewUser = {
  id: "demo-user",
  handle: "Demo user",
  initials: "DU",
  profileSlug: "demo-user",
};

function SignInOnMount() {
  const { signIn } = useAuthActions();

  useEffect(() => {
    void signIn();
  }, [signIn]);

  return null;
}

function AuthState() {
  const snapshot = useAuthSnapshot();

  return <output>{snapshot.status}</output>;
}

describe("AuthArea", () => {
  it("keeps the signed-in mobile account links and sign-out behavior in parity", async () => {
    render(
      <FoundationProvider config={{ mode: "mock", previewUser }}>
        <SignInOnMount />
        <AuthArea variant="mobile" />
        <AuthState />
      </FoundationProvider>,
    );

    await screen.findByText("Demo user");

    expect(screen.getByRole("link", { name: "My profile" }).getAttribute("href")).toBe(
      "/members/demo-user",
    );
    expect(screen.getByRole("link", { name: "My applications" }).getAttribute("href")).toBe(
      "/applications",
    );
    expect(screen.getByRole("link", { name: "My agents" }).getAttribute("href")).toBe("/agents");

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(screen.getByText("signed-out")).toBeTruthy());
    expect(screen.queryByRole("navigation", { name: "Account navigation" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
  });
});

describe("GoogleLoginButton", () => {
  it("shows a deterministic mock failure and clears it when retry succeeds", async () => {
    render(
      <FoundationProvider config={{ mode: "mock", previewUser }}>
        <GoogleLoginButton />
        <AuthState />
      </FoundationProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Preview failed sign-in" }));

    expect(
      (screen.getByRole("button", { name: "Starting Google sign-in…" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    await screen.findByRole("alert");

    expect(screen.getByRole("button", { name: "Retry Google sign-in" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Retry Google sign-in" }));

    await waitFor(() => expect(screen.getByText("signed-in")).toBeTruthy());
    expect(screen.queryByRole("alert")).toBeNull();
    expect(routerPush).toHaveBeenCalledWith("/signup/wallet");
  });
});

describe("API onboarding routing", () => {
  it("maps incomplete users to the first unfinished signup screen", () => {
    expect(getOnboardingPath({ ...previewUser, onboardingStep: 2 })).toBe("/signup/wallet");
    expect(getOnboardingPath({ ...previewUser, onboardingStep: 3 })).toBe("/signup/profile");
    expect(getOnboardingPath({ ...previewUser, onboardingStep: 4 })).toBe("/signup/get-started");
    expect(
      getOnboardingPath({ ...previewUser, onboardingStep: 4, onboardingCompleted: true }),
    ).toBeNull();
  });

  it("recovers incomplete sessions outside signup without trapping later signup steps", () => {
    const incomplete = { ...previewUser, onboardingStep: 1 };
    expect(shouldRedirectToOnboarding(incomplete, "/")).toBe("/signup/wallet");
    expect(shouldRedirectToOnboarding(incomplete, "/members/demo-user")).toBe(
      "/signup/wallet",
    );
    expect(shouldRedirectToOnboarding(incomplete, "/signup/profile")).toBeNull();
  });
});
