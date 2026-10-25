export type AuthStatus = "loading" | "signed-out" | "signed-in";

export type ClientUser = {
  id: string;
  handle: string;
  initials: string;
  profileSlug: string;
  walletAddress?: string;
  onboardingStep?: number;
  onboardingCompleted?: boolean;
  isAdmin?: boolean;
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

/** `signIn` options — `turnstileToken` is the Cloudflare Turnstile widget token forwarded to BE `GET /auth/google` (api mode only). */
export type SignInOptions = {
  turnstileToken?: string;
};

export type AuthAdapter = {
  initialize?: () => void;
  getSnapshot: () => AuthSnapshot;
  subscribe: (listener: () => void) => () => void;
  signIn: (options?: SignInOptions) => Promise<AuthSnapshot>;
  signOut: () => Promise<AuthSnapshot>;
};
