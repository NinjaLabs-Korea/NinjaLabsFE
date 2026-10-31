// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { useAccountQuery } from "@/components/hooks/useAccountQuery";
import type { AuthSnapshot } from "@/lib/contracts/auth";

let snapshot: AuthSnapshot;
vi.mock("@/components/auth/FoundationProvider", () => ({ useAuthSnapshot: () => snapshot }));

const user = (id: string) => ({ id }) as never;
const signedIn = (id: string): AuthSnapshot => ({ status: "signed-in", user: user(id) }) as AuthSnapshot;

function Probe({ read, label = "p" }: { read: (a: AuthSnapshot) => Promise<never>; label?: string }): ReactNode {
  const q = useAccountQuery(read);
  return <p data-testid={label}>{q.loading ? "loading" : `data:${String(q.data)}`}{q.revalidating ? ":re" : ""}</p>;
}

afterEach(cleanup);

describe("useAccountQuery (R2)", () => {
  it("reuses a young answer on remount without a loading frame and still fetches", async () => {
    snapshot = signedIn("u-reuse");
    const read = vi.fn(async () => ({ status: "ok", data: "A" }) as never);
    const first = render(<Probe read={read} />);
    await waitFor(() => expect(screen.getByTestId("p").textContent).toBe("data:A"));
    first.unmount();
    let resolve!: (v: never) => void;
    const slow = vi.fn(() => new Promise<never>((r) => { resolve = r; }));
    read.mockImplementationOnce(slow as never);
    render(<Probe read={read} />);
    expect(screen.getByTestId("p").textContent).toBe("data:A:re");
    expect(read).toHaveBeenCalledTimes(2);
    await act(async () => resolve({ status: "ok", data: "B" } as never));
    await waitFor(() => expect(screen.getByTestId("p").textContent).toBe("data:B"));
  });

  it("does not reuse across users", async () => {
    const read = vi.fn(async () => ({ status: "ok", data: "A" }) as never);
    snapshot = signedIn("u1");
    render(<Probe read={read} />);
    await waitFor(() => expect(screen.getByTestId("p").textContent).toBe("data:A"));
    cleanup();
    snapshot = signedIn("u2");
    read.mockImplementationOnce(() => new Promise<never>(() => undefined));
    render(<Probe read={read} />);
    expect(screen.getByTestId("p").textContent).toBe("loading");
  });

  it("two concurrent mounts issue one call", async () => {
    snapshot = signedIn("u-shared");
    const read = vi.fn(async () => ({ status: "ok", data: "S" }) as never);
    render(<><Probe label="a" read={read} /><Probe label="b" read={read} /></>);
    await waitFor(() => expect(screen.getByTestId("b").textContent).toBe("data:S"));
    expect(read).toHaveBeenCalledTimes(1);
  });
});
