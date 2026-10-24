import type { ClientUser } from "@/lib/contracts/auth";
import type { PayoutStatus } from "@/lib/types";

/** FE steps of an application; `open` = BE PENDING (applied, awaiting the sponsor), `submitted`/`completed` come from the submission join. */
export type ApplicationStatus = "open" | "approved" | "submitted" | "completed" | "rejected";

export type SubmissionStatus =
  | "submitted"
  | "resubmitted"
  | "in_review"
  | "revision_requested"
  | "approved"
  | "rejected";

/** Agent that made an application/submission on the owner's behalf; null when the owner acted directly. */
export type AccountAgentRef = { id: string; name: string };

export type AccountSubmission = {
  bountySlug: string;
  status: SubmissionStatus;
  agent: AccountAgentRef | null;
  /** BE `payment_status` (same rule as the public profile's `payoutStatus`); NONE when an older BE omits it. */
  paymentStatus: PayoutStatus;
};

export type AccountApplication = {
  id: string;
  bountySlug: string;
  bountyTitle: string;
  category: "Dev" | "Design" | "Content" | "Other";
  /** ISO timestamp; views format it at render (`useFormatter().dateTime`). */
  appliedAt: string;
  note: string;
  status: ApplicationStatus;
  agent: AccountAgentRef | null;
};

export type AgentStatus = "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED" | "REVOKED";
export type AgentKeyStatus = "ACTIVE" | "REVOKED" | "EXPIRED";

export type AccountAgent = {
  id: string;
  name: string;
  walletAddress: string;
  status: AgentStatus;
  verified: boolean;
  completedBounties: number;
  apiKeyMasked: string;
  /** ISO timestamp; null when no key has been issued. */
  keyExpiresAt: string | null;
  keyStatus: AgentKeyStatus | null;
  /** ISO timestamp; views format it at render (`useFormatter().dateTime`). */
  registeredAt: string;
};

export type Account = {
  user: ClientUser;
};
