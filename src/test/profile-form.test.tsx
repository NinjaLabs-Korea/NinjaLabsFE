// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NICKNAME_CHECK_DEBOUNCE_MS, ProfileForm } from "@/components/signup/ProfileForm";
import { ApiHttpError } from "@/lib/api/http";
import { renderWithIntl } from "@/test/intl";

const checkNickname = vi.fn();
const completeProfile = vi.fn();

vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({
    useOnboardingApi: () => ({ checkNickname, completeProfile, completeOnboarding: vi.fn() }),
    useAuthActions: () => ({ signIn: vi.fn(), signOut: vi.fn() }),
    useFoundationMode: () => "api",
    useAuthSnapshot: () => ({ status: "signed-in", user: { id: "u1", handle: "user_ab12cd", walletAddress: null } }),
  }));

const nicknameInput = () => screen.getByLabelText("Nickname*") as HTMLInputElement;
const typeNickname = (value: string) => fireEvent.change(nicknameInput(), { target: { value } });
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("ProfileForm nickname rule + availability check", () => {
  beforeEach(() => {
    checkNickname.mockReset();
    completeProfile.mockReset();
    checkNickname.mockResolvedValue({ available: true });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("debounces the availability check (400 ms) and only asks for values that pass the local rule", async () => {
    renderWithIntl(<ProfileForm />);
    typeNickname("n");
    typeNickname("ni");
    typeNickname("nin");
    typeNickname("ninja_dev");
    expect(screen.getByRole("status").textContent).toBe("Checking availability…");
    await sleep(NICKNAME_CHECK_DEBOUNCE_MS / 2);
    expect(checkNickname).not.toHaveBeenCalled();
    await waitFor(() => expect(checkNickname).toHaveBeenCalledTimes(1), { timeout: 1500 });
    expect(checkNickname).toHaveBeenCalledWith("ninja_dev");
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Nickname is available."));
  });

  it("does not call the API for an invalid nickname and reports the specific reason on submit", async () => {
    renderWithIntl(<ProfileForm />);
    for (const [value, reason] of [
      [".ninja", "Start and end with a letter or digit."],
      ["ninja dev", "Use only letters, digits, and _ . - (no spaces)."],
      ["admin", "This word is reserved. Choose another nickname."],
      ["n", "Use at least 2 characters."],
    ] as const) {
      typeNickname(value);
      fireEvent.submit(nicknameInput().closest("form")!);
      expect(await screen.findByText(reason)).toBeTruthy();
      expect(nicknameInput().getAttribute("aria-invalid")).toBe("true");
    }
    await sleep(NICKNAME_CHECK_DEBOUNCE_MS + 100);
    expect(checkNickname).not.toHaveBeenCalled();
    expect(completeProfile).not.toHaveBeenCalled();
  });

  it("shows 'taken' and blocks submit when the BE reports the nickname as unavailable", async () => {
    checkNickname.mockResolvedValue({ available: false });
    renderWithIntl(<ProfileForm />);
    typeNickname("ninja_dev");
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("That nickname is already taken."), { timeout: 1500 });
    fireEvent.click(screen.getByRole("button", { name: "Dev" }));
    fireEvent.change(screen.getByLabelText("Bio*"), { target: { value: "Builder" } });
    fireEvent.submit(nicknameInput().closest("form")!);
    // Said once, by the status line under the field: no second field alert and no form-level alert.
    await waitFor(() => expect(nicknameInput().getAttribute("aria-invalid")).toBe("true"));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getAllByText("That nickname is already taken.")).toHaveLength(1);
    expect(completeProfile).not.toHaveBeenCalled();
  });

  it("announces a nickname taken at save time (409 race) once, under the field", async () => {
    completeProfile.mockRejectedValue(new ApiHttpError(409, "NICKNAME_TAKEN"));
    renderWithIntl(<ProfileForm />);
    typeNickname("ninja_dev");
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Nickname is available."), { timeout: 1500 });
    fireEvent.click(screen.getByRole("button", { name: "Dev" }));
    fireEvent.change(screen.getByLabelText("Bio*"), { target: { value: "Builder" } });
    fireEvent.submit(nicknameInput().closest("form")!);
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("That nickname is already taken."));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getAllByText(/nickname is already/i)).toHaveLength(1);
  });

  it("caps the bio input at the BE limit", () => {
    renderWithIntl(<ProfileForm />);
    expect((screen.getByLabelText("Bio*") as HTMLTextAreaElement).maxLength).toBe(1000);
  });

  it("maps a BE VALIDATION_FAILED message[] to field hints by property name", async () => {
    completeProfile.mockRejectedValue(new ApiHttpError(400, "VALIDATION_FAILED", [
      "nickname must match /^x$/u regular expression",
      "bio must be shorter than or equal to 1000 characters",
    ]));
    renderWithIntl(<ProfileForm />);
    typeNickname("ninja_dev");
    fireEvent.click(screen.getByRole("button", { name: "Dev" }));
    fireEvent.change(screen.getByLabelText("Bio*"), { target: { value: "Builder" } });
    fireEvent.submit(nicknameInput().closest("form")!);
    await waitFor(() => expect(completeProfile).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("The server rejected this nickname. Check the rules above.")).toBeTruthy();
    expect(screen.getByText("The server rejected this bio. Keep it under 1000 characters.")).toBeTruthy();
    expect(nicknameInput().getAttribute("aria-describedby")).toContain("nickname-error");
  });
  it.each([
    ["INVALID_CHARACTER", "Your nickname or bio contains characters that cannot be saved (for example a NUL byte). Remove them and try again."],
    ["REFERENCE_NOT_FOUND", "Your account record could not be found. Reload the page or sign in again."],
    ["DATABASE_UNAVAILABLE", "The service is temporarily unavailable. Please try again in a moment."],
  ])("maps the BE %s code to its own save error", async (code, copy) => {
    completeProfile.mockRejectedValue(new ApiHttpError(code === "DATABASE_UNAVAILABLE" ? 503 : 400, code));
    renderWithIntl(<ProfileForm />);
    typeNickname("ninja_dev");
    fireEvent.click(screen.getByRole("button", { name: "Dev" }));
    fireEvent.change(screen.getByLabelText("Bio*"), { target: { value: "Builder" } });
    fireEvent.submit(nicknameInput().closest("form")!);
    await waitFor(() => expect(completeProfile).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(copy)).toBeTruthy();
  });

  it("sends one save request when several submit events land in the same tick", async () => {
    completeProfile.mockReturnValue(new Promise(() => undefined));
    renderWithIntl(<ProfileForm />);
    typeNickname("ninja_dev");
    fireEvent.click(screen.getByRole("button", { name: "Dev" }));
    fireEvent.change(screen.getByLabelText("Bio*"), { target: { value: "Builder" } });
    const form = nicknameInput().closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(completeProfile).toHaveBeenCalledTimes(1));
    await sleep(50);
    expect(completeProfile).toHaveBeenCalledTimes(1);
  });
});
