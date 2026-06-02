import { get, type ApiResult } from "./client";

export type MyProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
};

// The signed-in user's own profile basics (B2).
export function getMyProfile(): Promise<ApiResult<{ profile: MyProfile | null }>> {
  return get("/api/profile/me");
}
