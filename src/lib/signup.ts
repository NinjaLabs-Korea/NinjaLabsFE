export type SignupStep = 1 | 2 | 3 | 4;

export const signup = {
  badges: {
    login: "SIGN-UP FLOW (login in progress)",
    wallet: "NFT minted at sign-up",
    profile: "All fields required / no skip",
    completion: "SIGN-UP FLOW",
  },
  login: {
    title: "Sign in to start",
    description: "Create your Ninja Labs account with Google.",
    turnstile: "Bot check passes before Google OAuth starts",
    edgeCases: ["Google login declined or failed", "Retry after clearing the error"],
  },
  wallet: {
    title: "Connect your wallet",
    description: "Connect an Injective wallet to receive your Ninja NFT.",
    notice: "Your Ninja NFT is minted immediately after wallet connection.",
    reassurance: "Minting failure does not block signup and can retry from account.",
    details: [
      ["Recipient", "inj1…"],
      ["Standard", "CW-721 Nestable"],
      ["Minter", "AWS KMS platform master wallet"],
      ["Cost and limit", "~$0.0003 platform-paid · one user, one wallet, one Ninja NFT"],
      ["Failure path", "Mint failure does not block signup; retry from account."],
    ],
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
    footnote: "onboarding_completed_at is set when onboarding is complete.",
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
        href: "#",
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
