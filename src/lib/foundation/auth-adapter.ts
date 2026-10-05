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

// mock 세션 미리보기의 로그인 여부를 같은 탭 안에서만 기억하는 키.
// API 모드가 새로고침 후 JWT로 세션을 복원하듯, mock도 전체 페이지 이동(예: 프로필 저장 후) 뒤에 로그인 상태를 잇는다.
export const SESSION_PREVIEW_STORAGE_KEY = "ninjalabs.session-preview";

type PreviewStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function browserSessionStorage(): PreviewStorage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.sessionStorage;
  } catch {
    return undefined; // 저장소가 막힌 환경에서는 메모리 세션으로만 동작한다.
  }
}

export function createSessionPreviewAuthAdapter(
  user: ClientUser,
  storage: () => PreviewStorage | undefined = browserSessionStorage,
): AuthAdapter {
  const store = createSnapshotStore({ status: "signed-out", user: null });
  const remember = (signedIn: boolean) => {
    try {
      if (signedIn) storage()?.setItem(SESSION_PREVIEW_STORAGE_KEY, "signed-in");
      else storage()?.removeItem(SESSION_PREVIEW_STORAGE_KEY);
    } catch {
      // 저장 실패는 무시한다. 이 탭의 메모리 세션은 그대로 유지된다.
    }
  };

  return {
    // 서버 렌더와 하이드레이션은 항상 signed-out으로 맞추고, 마운트 후에만 저장된 세션을 복원한다.
    initialize: () => {
      try {
        if (storage()?.getItem(SESSION_PREVIEW_STORAGE_KEY) === "signed-in") {
          store.setSnapshot({ status: "signed-in", user });
        }
      } catch {
        // 읽기 실패 시 signed-out 유지.
      }
    },
    getSnapshot: store.getSnapshot,
    subscribe: store.subscribe,
    signIn: async () => {
      await waitForMockAuthOutcome();
      remember(true);
      return store.setSnapshot({ status: "signed-in", user });
    },
    signOut: async () => {
      remember(false);
      return store.setSnapshot({ status: "signed-out", user: null });
    },
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
