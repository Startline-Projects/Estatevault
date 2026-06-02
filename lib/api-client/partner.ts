import { post, put, get, publicGet, type ApiResult } from "./client";
import type { Database } from "@/types/db.generated";

export type MyPartner = Database["public"]["Tables"]["partners"]["Row"];

// The signed-in partner's own row (B2). null if the profile has no partner row.
export function getMe(): Promise<ApiResult<{ partner: MyPartner | null }>> {
  return get("/api/partner/me");
}

export type BrandingResult = {
  id?: string;
  company_name?: string;
  logo_url?: string;
  accent_color?: string;
  theme_preset?: string;
  hero_recipe?: string;
  custom_gradient?: string;
  subdomain?: string;
  custom_domain?: string;
};

export function createClient(body: Record<string, unknown>): Promise<ApiResult<{ clientId: string }>> {
  return post("/api/partner/clients", body);
}

export function updateClient(body: {
  clientId: string;
  partnerId: string;
  note: string;
}): Promise<ApiResult<{ success: boolean }>> {
  return put("/api/partner/clients", body);
}

export function addDomain(body: {
  businessUrl: string;
  domainType: string;
}): Promise<ApiResult<{ success: boolean; domain?: string }>> {
  return post("/api/partner/add-domain", body);
}

export function verifyDomain(domain: string): Promise<ApiResult<{ verified: boolean }>> {
  return get("/api/partner/verify-domain", { domain });
}

export function checkVaultSubdomain(subdomain: string): Promise<ApiResult<{ available: boolean }>> {
  return get("/api/partner/vault-subdomain", { subdomain });
}

export function claimVaultSubdomain(partnerId: string, subdomain: string): Promise<ApiResult<{ success: boolean }>> {
  return post("/api/partner/vault-subdomain", { partnerId, subdomain });
}

export function vaultClientCheckout(body: {
  clientName: string;
  clientEmail: string;
  tempPassword: string;
  pin: string;
}): Promise<ApiResult<{ url: string }>> {
  return post("/api/partner/vault-client-checkout", body);
}

export function stripeConnect(): Promise<ApiResult<{ url: string }>> {
  return post("/api/partner/stripe-connect");
}

export function emailSetup(body: {
  sender_name: string;
  sender_email: string;
}): Promise<ApiResult<{ records?: unknown[] }>> {
  return post("/api/partner/email/setup", body);
}

export function emailVerify(): Promise<ApiResult<{ verified: boolean }>> {
  return post("/api/partner/email/verify");
}

export function emailTest(): Promise<ApiResult<{ success: boolean }>> {
  return post("/api/partner/email/test");
}

export function getBranding(params: {
  id?: string;
  domain?: string;
}): Promise<ApiResult<BrandingResult>> {
  return publicGet("/api/partners/branding", params);
}

export function createReviewAttorney(body: {
  partnerId: string;
  attorneyName: string;
  attorneyEmail: string;
  barNumber: string;
}): Promise<ApiResult<{ success: boolean }>> {
  return post("/api/partners/create-review-attorney", body);
}
