import { post, publicPost, type ApiResult } from "./client";

export type CheckEmailResult = { exists: boolean; userId?: string; fullName?: string | null; hasWill?: boolean; hasTrust?: boolean; hasVault?: boolean };
export type VerifyCodeResult = { token: string };
export type CheckVerificationResult = { verified: boolean; token?: string };
export type HandoffResult = { url: string };
export type ConsumeHandoffResult = { access_token: string; refresh_token: string; redirect_path: string };

export function checkEmail(email: string): Promise<ApiResult<CheckEmailResult>> {
  return publicPost("/api/auth/check-email", { email });
}

export function sendVerifyCode(email: string, partnerSlug?: string): Promise<ApiResult<{ success: boolean }>> {
  return publicPost("/api/auth/send-verify-code", { email, partnerSlug });
}

export function verifyCode(email: string, code: string): Promise<ApiResult<VerifyCodeResult>> {
  return publicPost("/api/auth/verify-code", { email, code });
}

export function sendVerifyLink(
  email: string,
  sessionId: string,
  partnerId?: string,
  partnerSlug?: string,
): Promise<ApiResult<{ success: boolean }>> {
  return publicPost("/api/auth/send-verify-link", { email, sessionId, partnerId, partnerSlug });
}

export function checkVerification(email: string, sessionId: string): Promise<ApiResult<CheckVerificationResult>> {
  return publicPost("/api/auth/check-verification", { email, sessionId });
}

export function resendVerification(email: string): Promise<ApiResult<{ success: boolean }>> {
  return publicPost("/api/auth/resend-verification", { email });
}

export function sendWelcome(): Promise<ApiResult<{ success: boolean }>> {
  return post("/api/auth/welcome");
}

export function createHandoff(body: {
  access_token: string;
  refresh_token: string;
  target: string;
  redirect_path?: string;
}): Promise<ApiResult<HandoffResult>> {
  return post("/api/auth/handoff", body);
}

export function consumeHandoff(token: string): Promise<ApiResult<ConsumeHandoffResult>> {
  return publicPost("/api/auth/handoff/consume", { token });
}

export function recovery(email: string): Promise<ApiResult<{ success: boolean }>> {
  return publicPost("/api/auth/recovery", { email });
}

export function setPassword(body: {
  email: string;
  password: string;
  fullName?: string;
  verifiedToken?: string;
  userId?: string;
}): Promise<ApiResult<{ success: boolean }>> {
  return publicPost("/api/auth/set-password", body);
}
