import { post, put, get, publicGet, type ApiResult } from "./client";
import type { Database } from "@/types/db.generated";

export type MyPartner = Database["public"]["Tables"]["partners"]["Row"];

// The signed-in partner's own row (B2). null if the profile has no partner row.
export function getMe(): Promise<ApiResult<{ partner: MyPartner | null }>> {
  return get("/api/partner/me");
}

export type Referral = {
  id: string;
  reason: string | null;
  status: string | null;
  created_at: string | null;
  referral_fee: number | null;
  referral_fee_paid: boolean | null;
};

// The signed-in partner's attorney referrals (B2).
export function getReferrals(): Promise<ApiResult<{ referrals: Referral[] }>> {
  return get("/api/partner/referrals");
}

export type PartnerClient = {
  id: string;
  profile_id: string;
  created_at: string;
  profiles: { full_name: string; email: string } | null;
  orders: Array<{ product_type: string; status: string; partner_cut: number }>;
};

// The signed-in partner's clients with order summaries (B2).
export function listClients(): Promise<ApiResult<{ clients: PartnerClient[] }>> {
  return get("/api/partner/clients");
}

export type VaultClient = {
  id: string;
  profile_id: string;
  created_at: string;
  vault_subscription_status: string | null;
  profiles: { full_name: string | null; email: string } | null;
};

// The signed-in partner's vault-subscription clients (B2).
export function listVaultClients(): Promise<ApiResult<{ clients: VaultClient[] }>> {
  return get("/api/partner/vault-clients");
}

export type PartnerOrder = {
  id: string;
  product_type: string;
  status: string;
  created_at: string | null;
  client_id: string | null;
  clients: { profiles: { full_name: string | null; email: string } | null } | null;
};

// The signed-in partner's document orders with client info (B2).
export function listDocuments(): Promise<ApiResult<{ orders: PartnerOrder[] }>> {
  return get("/api/partner/documents");
}

export type DashboardData = {
  partner: {
    id: string;
    company_name: string | null;
    business_url: string | null;
    certification_completed: boolean | null;
    tier: string | null;
    vault_subdomain: string | null;
    accent_color: string | null;
  } | null;
  stats: { clients: number; docsThisMonth: number; mtdEarnings: number; referralFees: number };
  vaultStats: { vaultClients: number; activeSubscriptions: number };
  recentActivity: Array<{ action: string; created_at: string | null }>;
};

// The signed-in partner's dashboard summary (B2).
export function getDashboard(): Promise<ApiResult<DashboardData>> {
  return get("/api/partner/dashboard");
}

export type ClientDetailData = {
  client: { id: string; created_at: string; profiles: { full_name: string | null; email: string; phone: string | null } | null };
  orders: Array<Record<string, unknown>>;
  docs: Array<{ id: string; document_type: string; status: string; created_at: string | null }>;
  notes: Array<{ id: string; note: string; created_at: string | null }>;
  activity: Array<{ action: string; created_at: string | null }>;
};

// A single client's detail for the partner (B2, with ownership check server-side).
export function getClientDetail(clientId: string): Promise<ApiResult<ClientDetailData>> {
  return get(`/api/partner/clients/${clientId}`);
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
