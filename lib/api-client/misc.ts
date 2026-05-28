import { post, get, publicPost, type ApiResult } from "./client";

export function contact(body: {
  name: string;
  email: string;
  message: string;
}): Promise<ApiResult<{ success: boolean }>> {
  return publicPost("/api/contact", body);
}

export function requestProfessionalAccess(body: Record<string, unknown>): Promise<ApiResult<{ success: boolean }>> {
  return publicPost("/api/professionals/request-access", body);
}

export function affiliateSignup(body: {
  fullName: string;
  email: string;
  password: string;
  acceptTerms: boolean;
}): Promise<ApiResult<{ code: string; onboardingUrl: string }>> {
  return publicPost("/api/affiliate/signup", body);
}

export function affiliateOnboarding(): Promise<ApiResult<{ url: string }>> {
  return post("/api/affiliate/onboarding");
}

export function getPartnerMarketingMaterials(): Promise<ApiResult<{ materials: unknown[] }>> {
  return get("/api/marketing/materials");
}

export function stripeConnectOnboard(body?: { returnPath?: string }): Promise<ApiResult<{ url: string }>> {
  return post("/api/stripe/connect/onboard", body);
}
