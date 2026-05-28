import { get, post, publicPost, type ApiResult } from "./client";

export function getFileKey(): Promise<ApiResult<{ key: string }>> {
  return get("/api/trustee/vault/file-key");
}

export function logout(): Promise<ApiResult<{ success: boolean }>> {
  return post("/api/trustee/logout");
}

export function getItems(): Promise<ApiResult<{
  items: unknown[];
  documents: unknown[];
  farewell: unknown[];
  clientName?: string;
}>> {
  return get("/api/trustee/vault/items");
}

export function getDownloadUrl(type: string, id: string): Promise<ApiResult<{ url: string }>> {
  return get("/api/trustee/vault/download-url", { type, id });
}

export function sendOtp(token: string): Promise<ApiResult<{ success: boolean }>> {
  return publicPost("/api/trustee/unlock-otp", { token });
}

export function verifyOtp(token: string, code: string): Promise<ApiResult<{ success: boolean }>> {
  return publicPost("/api/trustee/unlock-verify", { token, code });
}
