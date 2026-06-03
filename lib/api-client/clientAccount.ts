import { get, patch, type ApiResult } from "./client";

// B2: the signed-in client's funding checklist + trust asset types.
export function getFundingChecklist(): Promise<
  ApiResult<{ checklist: Record<string, boolean>; assetTypes: string[] }>
> {
  return get("/api/client/funding-checklist");
}

export function updateFundingChecklist(
  checklist: Record<string, boolean>,
): Promise<ApiResult<{ success: boolean }>> {
  return patch("/api/client/funding-checklist", { checklist });
}

export type ClientSettings = {
  profile: { full_name: string | null; phone: string | null; email: string | null; notification_preferences: Record<string, boolean> | null } | null;
  advisor: { advisor_name: string | null; advisor_firm: string | null; advisor_share_consent: boolean | null } | null;
};

// The signed-in client's settings (profile contact + advisor sharing).
export function getClientSettings(): Promise<ApiResult<ClientSettings>> {
  return get("/api/client/settings");
}

export function updateClientProfile(patch_: {
  full_name?: string;
  phone?: string | null;
  notification_preferences?: Record<string, boolean>;
}): Promise<ApiResult<{ success: boolean }>> {
  return patch("/api/client/settings", { kind: "profile", ...patch_ });
}

export function updateClientAdvisor(patch_: {
  advisor_name?: string | null;
  advisor_firm?: string | null;
  advisor_share_consent?: boolean;
}): Promise<ApiResult<{ success: boolean }>> {
  return patch("/api/client/settings", { kind: "advisor", ...patch_ });
}
