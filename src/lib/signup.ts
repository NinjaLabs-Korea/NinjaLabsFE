export const signup = {
  badges: {
    wallet: "NFT minted at sign-up",
    profile: "All fields required / no skip",
    completion: "SIGN-UP FLOW",
  },
  login: {
    mock: {
      badge: "SIGN-UP FLOW · SESSION PREVIEW",
      title: "Preview the Ninja Labs sign-in flow",
      description:
        "Explore this step with a local session preview. It does not contact Google or create an account.",
      disclosure:
        "Mock mode is local and test only. This preview does not contact Google or create an account.",
      statusTitle: "Preview status",
      edgeCases: [
        "Selecting the button starts a local session preview only",
        "Google authentication is not invoked",
      ],
    },
    api: {
      badge: "SIGN-UP FLOW",
      title: "Sign in to Ninja Labs",
      description:
        "Continue with Google to create your account. You will be redirected to Google and back here once you approve.",
      disclosure:
        "Signing in creates or restores your Ninja Labs account. We only receive your Google email — no password is shared.",
      statusTitle: "How it works",
      edgeCases: [
        "You are redirected to Google's consent screen and back after approval",
        "A new account starts at onboarding step 1; returning users resume their session",
      ],
    },
  },
  wallet: {
    title: "Connect your wallet",
  },
  profile: {
    title: "Set up your profile",
    nickname: "jaemin",
    availability: "Real-time duplicate check: jaemin.inj is available.",
    bio: "Frontend builder focused on Injective market data, wallet onboarding, and bounty-ready UI components.",
    requirements: [
      "Spam control and profile quality",
      "Complete the signup funnel in one flow",
      "No skipping or draft saving",
    ],
  },
  completion: {
    title: "What would you like to do?",
    subtitle: "All skippable and revisitable from main navigation.",
    actions: [
      {
        title: "Browse active bounties",
        description: "Find a bounty and start building your on-chain track record.",
        href: "/bounties",
        icon: "→",
      },
      {
        title: "Try Injective in the Playground",
        description: "Explore Injective before choosing your next bounty.",
        href: "https://playground.injective.network",
        icon: "↗",
      },
      {
        title: "Learn more about Ninja Labs",
        description: "Discover the builder community and bounty marketplace.",
        href: "/",
        icon: "mascot",
      },
    ],
  },
} as const;
