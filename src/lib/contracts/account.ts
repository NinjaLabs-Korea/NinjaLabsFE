import type { ClientUser } from "@/lib/contracts/auth";

export type ApplicationStatus = "open" | "under_review" | "approved" | "submitted" | "completed";

export type AccountApplication = {
  bountySlug: string;
  bountyTitle: string;
  category: "Dev" | "Design" | "Content" | "Other";
  appliedAt: string;
  note: string;
  status: ApplicationStatus;
};

export type AccountAgent = {
  name: string;
  walletAddress: string;
  verified: boolean;
  completedBounties: number;
  apiKeyMasked: string;
  registeredAt: string;
};

export type Account = {
  user: ClientUser;
};
