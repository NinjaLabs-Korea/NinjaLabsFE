export type AuthStatus = "loading" | "signed-out" | "signed-in";

export type ClientUser = {
  id: string;
  handle: string;
  initials: string;
  profileSlug: string;
  walletAddress?: string;
  onboardingStep?: number;
  onboardingCompleted?: boolean;
};

export type SignedOutAuthSnapshot = {
  status: "loading" | "signed-out";
  user: null;
};

export type SignedInAuthSnapshot = {
  status: "signed-in";
  user: ClientUser;
};

export type AuthSnapshot = SignedOutAuthSnapshot | SignedInAuthSnapshot;

export type AuthAdapter = {
  initialize?: () => void;
  getSnapshot: () => AuthSnapshot;
  subscribe: (listener: () => void) => () => void;
  signIn: () => Promise<AuthSnapshot>;
  signOut: () => Promise<AuthSnapshot>;
};
