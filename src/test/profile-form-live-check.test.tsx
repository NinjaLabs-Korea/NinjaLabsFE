// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NICKNAME_CHECK_DEBOUNCE_MS, ProfileForm } from "@/components/signup/ProfileForm";
import { renderWithIntl } from "@/test/intl";

const checkNickname = vi.fn<(nickname: string) => Promise<{ available: boolean }>>();
const completeProfile = vi.fn();
// Stable like the provider's client, so the debounce effect only re-runs when the nickname changes.
const onboardingApi = { checkNickname, completeProfile, completeOnboarding: vi.fn() };

vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({
    useOnboardingApi: () => onboardingApi,
    useFoundationMode: () => "api",
  }));

const nicknameInput = () => screen.getByLabelText("Nickname*") as HTMLInputElement;
const typeNickname = (value: string) => fireEvent.change(nicknameInput(), { target: { value } });
const status = () => screen.getByRole("status").textContent;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("ProfileForm nickname live check", () => {
  beforeEach(() => {
    checkNickname.mockReset();
    completeProfile.mockReset();
  });

  it("ignores a slow answer for a nickname the user has already changed", async () => {
    let answerFirst: (value: { available: boolean }) => void = () => undefined;
    checkNickname.mockImplementationOnce(() => new Promise((resolve) => { answerFirst = resolve; }));
    checkNickname.mockImplementationOnce(async () => ({ available: true }));
    renderWithIntl(<ProfileForm />);

    typeNickname("taken_one");
    await waitFor(() => expect(checkNickname).toHaveBeenCalledWith("taken_one"), { timeout: 1500 });
    typeNickname("fresh_one");
    await waitFor(() => expect(status()).toBe("Nickname is available."), { timeout: 1500 });

    // The first request answers late with "taken": it must not overwrite the current nickname's result.
    await act(async () => answerFirst({ available: false }));
    expect(status()).toBe("Nickname is available.");
    expect(nicknameInput().getAttribute("aria-describedby")).toContain("nickname-status");
  });

  it("checks the trimmed value and does not re-check when only surrounding spaces change", async () => {
    checkNickname.mockResolvedValue({ available: true });
    renderWithIntl(<ProfileForm />);
    typeNickname("  ninja  ");
    await waitFor(() => expect(status()).toBe("Nickname is available."), { timeout: 1500 });
    expect(checkNickname).toHaveBeenCalledWith("ninja");

    typeNickname("ninja ");
    expect(status()).toBe("Nickname is available.");
    await sleep(NICKNAME_CHECK_DEBOUNCE_MS + 100);
    expect(checkNickname).toHaveBeenCalledTimes(1);
  });

  it("falls back to no verdict (and does not block submit) when the availability check fails", async () => {
    checkNickname.mockRejectedValue(new Error("network"));
    completeProfile.mockReturnValue(new Promise(() => undefined));
    renderWithIntl(<ProfileForm />);
    typeNickname("ninja_dev");
    expect(status()).toBe("Checking availability…");
    await waitFor(() => expect(status()).toBe(""), { timeout: 1500 });
    expect(nicknameInput().getAttribute("aria-describedby") ?? "").not.toContain("nickname-status");

    fireEvent.click(screen.getByRole("button", { name: "Dev" }));
    fireEvent.change(screen.getByLabelText("Bio*"), { target: { value: "Builder" } });
    fireEvent.submit(nicknameInput().closest("form") as HTMLFormElement);
    await waitFor(() => expect(completeProfile).toHaveBeenCalledWith({ nickname: "ninja_dev", bio: "Builder", tags: ["DEV"] }));
  });

  it("clears the verdict as soon as the nickname breaks the local rule", async () => {
    checkNickname.mockResolvedValue({ available: false });
    renderWithIntl(<ProfileForm />);
    typeNickname("ninja_dev");
    await waitFor(() => expect(status()).toBe("That nickname is already taken."), { timeout: 1500 });
    typeNickname("n");
    expect(status()).toBe("");
  });

  it("requires a tag and a bio before saving", async () => {
    checkNickname.mockResolvedValue({ available: true });
    renderWithIntl(<ProfileForm />);
    typeNickname("ninja_dev");
    await waitFor(() => expect(status()).toBe("Nickname is available."), { timeout: 1500 });
    fireEvent.submit(nicknameInput().closest("form") as HTMLFormElement);
    const alerts = await screen.findAllByRole("alert");
    expect(alerts.length).toBeGreaterThanOrEqual(2);
    expect((screen.getByLabelText("Bio*") as HTMLTextAreaElement).getAttribute("aria-invalid")).toBe("true");
    expect(completeProfile).not.toHaveBeenCalled();
  });
});
