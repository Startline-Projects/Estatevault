import { post, get, patch, type ApiResult } from "./client";

export type PinCheckResult = { hasPin: boolean; selfSet?: boolean };
export type PinCreateResult = { success: boolean };
export type PinVerifyResult = { valid: boolean };

export function pinAction(body: {
  action: "check" | "create" | "verify" | "change";
  pin?: string;
  newPin?: string;
}): Promise<ApiResult<PinCheckResult | PinCreateResult | PinVerifyResult>> {
  return post("/api/vault/pin", body);
}

export function downloadDocument(itemId: string): Promise<ApiResult<{ url: string }>> {
  return get("/api/vault/download-document", { item_id: itemId });
}

export function farewellSignedUrl(id: string): Promise<ApiResult<{ url: string }>> {
  return get(`/api/vault/farewell/${id}/signed-url`);
}

export function confirmTrustee(token: string): Promise<ApiResult<{ success: boolean }>> {
  return patch("/api/vault/trustees", { token });
}
