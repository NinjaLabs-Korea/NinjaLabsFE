// @vitest-environment jsdom
import { act, render, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cohortAcceptingHint, useCurrentCohort } from "@/components/hooks/useCurrentCohort";
import type { PublicCohort } from "@/lib/cohorts";

const cohort: PublicCohort = { id: "c1", name: "2nd", description: "", opensAt: null, closesAt: null, acceptingApplications: true, questions: [] };
let api: { getCurrentCohort: ReturnType<typeof vi.fn> };
vi.mock("@/components/auth/FoundationProvider", async () =>
  (await import("./support/foundation")).foundationMock({ useCohortApi: () => api }));

function Two() {
  useCurrentCohort();
  useCurrentCohort();
  return null;
}

beforeEach(() => {
  api = { getCurrentCohort: vi.fn(async () => cohort) };
  window.sessionStorage.clear();
});
afterEach(() => window.sessionStorage.clear());

describe("useCurrentCohort sharing", () => {
  it("sends one read for two readers mounted together", async () => {
    render(<Two />);
    await act(async () => undefined);
    expect(api.getCurrentCohort).toHaveBeenCalledTimes(1);
  });

  it("starts a remount from the last answer as ready, and still re-reads", async () => {
    const first = renderHook(() => useCurrentCohort());
    await waitFor(() => expect(first.result.current.status).toBe("ready"));
    first.unmount();
    const second = renderHook(() => useCurrentCohort());
    expect(second.result.current).toMatchObject({ status: "ready", cohort });
    await act(async () => undefined);
    expect(api.getCurrentCohort).toHaveBeenCalledTimes(2);
  });

  it("reload hits the network again once the first read settled", async () => {
    const view = renderHook(() => useCurrentCohort());
    await waitFor(() => expect(view.result.current.status).toBe("ready"));
    act(() => view.result.current.reload());
    await waitFor(() => expect(api.getCurrentCohort).toHaveBeenCalledTimes(2));
  });

  it("records a per-tab accepting hint on every successful read", async () => {
    expect(cohortAcceptingHint()).toBeNull();
    const view = renderHook(() => useCurrentCohort());
    await waitFor(() => expect(view.result.current.status).toBe("ready"));
    expect(cohortAcceptingHint()).toBe(true);
  });
});
