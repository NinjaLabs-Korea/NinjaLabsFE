// Sign-up UI copy lives in messages `signup`; this file holds keys, hrefs and mock fixtures.
export const signup = {
  login: {
    // Keys under messages `signup.login.<mode>.edgeCases`.
    edgeCaseKeys: ["first", "second"],
  },
  profile: {
    // Mock-mode prefill (fixture content, not UI copy).
    nickname: "jaemin",
    bio: "Frontend builder focused on Injective market data, wallet onboarding, and bounty-ready UI components.",
    // Keys under messages `signup.profile.requirements`.
    requirementKeys: ["spamControl", "oneFlow", "noSkip"],
  },
  completion: {
    // `key` resolves under messages `signup.getStarted.actions`.
    actions: [
      { key: "browseBounties", href: "/bounties", icon: "→" },
      { key: "injectiveDocs", href: "https://docs.injective.network/developers-evm", icon: "↗" },
      { key: "learnMore", href: "/", icon: "mascot" },
    ],
  },
} as const;
