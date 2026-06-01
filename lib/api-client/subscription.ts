import { get, post, type ApiResult } from "./client";

export type SubscriptionStatus = {
  status: string;
  expiry?: string | null;
  canAmendFree?: boolean;
  canUseFarewell?: boolean;
  subscriptionId?: string;
  currentPeriodEnd?: string;
};

export function getStatus(): Promise<ApiResult<SubscriptionStatus>> {
  return get("/api/subscription/status");
}

export function sync(): Promise<ApiResult<{ status: string }>> {
  return post("/api/subscription/sync");
}
