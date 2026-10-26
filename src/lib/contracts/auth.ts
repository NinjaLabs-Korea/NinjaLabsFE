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
  /** Profile bio and field tags (BE codes `DEV|DESIGN|CONTENT|OTHER`), as saved; prefill for the profile editor on /account. */
  bio?: string;
  tags?: string[];
  /** Parent Ninja NFT status (BE `nft.status`: PENDING, MINTING, MINTED, ...), or null when none exists yet. */
  nftStatus?: string | null;
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
  /** Starts the session restore (once per adapter) and cross-tab listening; the returned teardown stops the listening. */
  initialize?: () => void | (() => void);
  getSnapshot: () => AuthSnapshot;
  /** Re-reads the signed-in user (`GET /auth/me`) and publishes it, e.g. after onboarding completed or the profile/wallet changed. A failed read keeps the current snapshot. */
  refresh?: () => Promise<AuthSnapshot>;
  subscribe: (listener: () => void) => () => void;
  signIn: (options?: SignInOptions) => Promise<AuthSnapshot>;
  signOut: () => Promise<AuthSnapshot>;
};
