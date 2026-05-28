import { publicPost, publicGet, postForm, type ApiResult } from "./client";

export type FarewellAccessResult = {
  status: string;
  farewell_messages?: unknown[];
  documents?: unknown[];
  vault_items?: unknown[];
};

export function verify(formData: FormData): Promise<ApiResult<{ success: boolean }>> {
  return postForm("/api/farewell/verify", formData);
}

export function access(clientId: string, trusteeEmail: string): Promise<ApiResult<FarewellAccessResult>> {
  return publicPost("/api/farewell/access", { clientId, trusteeEmail });
}

export function checkVeto(token: string): Promise<ApiResult<{ valid: boolean }>> {
  return publicGet("/api/farewell/owner-veto", { token });
}

export function executeVeto(token: string): Promise<ApiResult<{ success: boolean }>> {
  return publicPost("/api/farewell/owner-veto", { token });
}
