import type { AuthAdapter, AuthSnapshot, ClientUser } from "@/lib/contracts/auth";

export class AuthAdapterUnavailableError extends Error {
  constructor() {
    super("Authentication is unavailable while API mode is a frontend-only placeholder.");
    this.name = "AuthAdapterUnavailableError";
  }
}
export class MockSignInPreviewError extends Error {
  constructor() {
    super("Mock Google sign-in failed. No request was made.");
    this.name = "MockSignInPreviewError";
  }
}

function waitForMockAuthOutcome(): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, 0);
  });
}

export async function simulateMockSignInFailure(): Promise<never> {
  await waitForMockAuthOutcome();
  throw new MockSignInPreviewError();
}

function createSnapshotStore(initialSnapshot: AuthSnapshot): {
  getSnapshot: () => AuthSnapshot;
  setSnapshot: (snapshot: AuthSnapshot) => AuthSnapshot;
  subscribe: (listener: () => void) => () => void;
} {
  let snapshot = initialSnapshot;
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => snapshot,
    setSnapshot: (nextSnapshot) => {
      snapshot = nextSnapshot;
      listeners.forEach((listener) => listener());
      return snapshot;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function createSessionPreviewAuthAdapter(user: ClientUser): AuthAdapter {
  const store = createSnapshotStore({ status: "signed-out", user: null });

  return {
    getSnapshot: store.getSnapshot,
    subscribe: store.subscribe,
    signIn: async () => {
      await waitForMockAuthOutcome();
      return store.setSnapshot({ status: "signed-in", user });
    },
    signOut: async () => store.setSnapshot({ status: "signed-out", user: null }),
  };
}

export function createUnavailableAuthAdapter(): AuthAdapter {
  const store = createSnapshotStore({ status: "signed-out", user: null });

  return {
    getSnapshot: store.getSnapshot,
    subscribe: store.subscribe,
    signIn: async () => {
      throw new AuthAdapterUnavailableError();
    },
    signOut: async () => store.getSnapshot(),
  };
}
