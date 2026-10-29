// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAdminRecordDelete, useSingleFlight } from "@/components/admin/useAdminList";

const pushAdminToast = vi.hoisted(() => vi.fn());
vi.mock("@/components/admin/AdminToastHost", () => ({ pushAdminToast }));

beforeEach(() => pushAdminToast.mockClear());

describe("useSingleFlight", () => {
  it("ignores calls while one is in flight and accepts the next after it settles", async () => {
    let release!: () => void;
    const fn = vi.fn(() => new Promise<void>((resolve) => { release = resolve; }));
    const { result } = renderHook(() => useSingleFlight(fn));
    const first = result.current();
    void result.current();
    expect(fn).toHaveBeenCalledTimes(1);
    await act(async () => { release(); await first; });
    void result.current();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("releases the guard when the handler throws", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("x")).mockResolvedValue(undefined);
    const { result } = renderHook(() => useSingleFlight(fn));
    await act(async () => { await result.current().catch(() => undefined); });
    await act(async () => { await result.current(); });
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe("useAdminRecordDelete", () => {
  type Row = { id: string };
  const setup = (call: (row: Row) => Promise<unknown>) => {
    const setRecords = vi.fn();
    const closeDialog = vi.fn();
    const onRemoved = vi.fn();
    const reload = vi.fn().mockResolvedValue(undefined);
    const hook = renderHook(() => useAdminRecordDelete<Row>({
      call, keyOf: (row) => row.id, setRecords, closeDialog, onRemoved, reload,
      describeError: () => "boom", successToast: (row) => ({ title: "deleted", description: row.id }), failedTitle: "failed",
    }));
    return { ...hook, setRecords, closeDialog, onRemoved, reload };
  };

  it("deletes once on a double click, drops the row, and toasts success", async () => {
    let release!: () => void;
    const call = vi.fn(() => new Promise<void>((resolve) => { release = resolve; }));
    const { result, setRecords, closeDialog, onRemoved, reload } = setup(call);
    let first!: Promise<void>;
    act(() => { first = result.current({ id: "a" }); void result.current({ id: "a" }); });
    expect(call).toHaveBeenCalledTimes(1);
    expect(closeDialog).toHaveBeenCalledTimes(1);
    await act(async () => { release(); await first; });
    const updater = setRecords.mock.calls[0][0] as (rows: Row[]) => Row[];
    expect(updater([{ id: "a" }, { id: "b" }])).toEqual([{ id: "b" }]);
    expect(onRemoved).toHaveBeenCalledWith({ id: "a" });
    expect(pushAdminToast).toHaveBeenCalledWith({ variant: "success", title: "deleted", description: "a" });
    expect(reload).not.toHaveBeenCalled();
  });

  it("toasts the failure and re-reads the list", async () => {
    const { result, setRecords, onRemoved, reload } = setup(() => Promise.reject(new Error("409")));
    await act(async () => { await result.current({ id: "a" }); });
    expect(setRecords).not.toHaveBeenCalled();
    expect(onRemoved).not.toHaveBeenCalled();
    expect(pushAdminToast).toHaveBeenCalledWith({ variant: "danger", title: "failed", description: "boom" });
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
