import { get, patch, type ApiResult } from "./client";

export type MyProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  user_type: string | null;
};

// The signed-in user's own profile basics (B2).
export function getMyProfile(): Promise<ApiResult<{ profile: MyProfile | null }>> {
  return get("/api/profile/me");
}

// Self-update the signed-in user's display name (B2).
export function updateMyName(fullName: string): Promise<ApiResult<{ success: boolean }>> {
  return patch("/api/profile/me", { full_name: fullName });
}
