import type { Account, AccountAgent, AccountApplication } from "@/lib/contracts/account";
import type { AuthSnapshot } from "@/lib/contracts/auth";

export type ApiAvailable<T> = {
  status: "available";
  data: T;
};

export type ApiUnavailable = {
  status: "unavailable";
  reason: "api-mode-placeholder" | "network-error";
};

export type ApiResult<T> = ApiAvailable<T> | ApiUnavailable;

export type ApiClient = {
  getAccount: (auth: AuthSnapshot) => Promise<ApiResult<Account | null>>;
  getApplications: (auth: AuthSnapshot) => Promise<ApiResult<readonly AccountApplication[]>>;
  getAgents: (auth: AuthSnapshot) => Promise<ApiResult<readonly AccountAgent[]>>;
};
