import { get, post, type ApiResult } from "./client";

export type SubscriptionStatus = {
  status: string;
  expiry?: string | null;
  canAmendFree?: boolean;
  canUseFarewell?: boolean;
  cancelAtPeriodEnd?: boolean;
  daysRemaining?: number | null;
  subscriptionId?: string;
  currentPeriodEnd?: string;
};

export function getStatus(): Promise<ApiResult<SubscriptionStatus>> {
  return get("/api/subscription/status");
}

export function sync(): Promise<ApiResult<{ status: string }>> {
  return post("/api/subscription/sync");
}

export function cancel(): Promise<ApiResult<{ success: boolean }>> {
  return post("/api/subscription/cancel");
}
