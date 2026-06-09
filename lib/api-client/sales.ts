import { post, get, patch, del, type ApiResult } from "./client";

// --- B2 sales pipeline (prospects CRUD) ---
export function getProspects(): Promise<ApiResult<{ prospects: unknown[]; partners: unknown[] }>> {
  return get("/api/sales/prospects");
}
export function createProspect(body: Record<string, unknown>): Promise<ApiResult<{ id: string }>> {
  return post("/api/sales/prospects", body);
}
export function updateProspect(id: string, patch_: Record<string, unknown>): Promise<ApiResult<{ success: boolean }>> {
  return patch(`/api/sales/prospects/${id}`, patch_);
}
export function deleteProspect(id: string): Promise<ApiResult<{ success: boolean }>> {
  return del(`/api/sales/prospects/${id}`);
}
export function getProspectActivity(id: string): Promise<ApiResult<{ activity: unknown[] }>> {
  return get(`/api/sales/prospects/${id}/activity`);
}
export function logProspectActivity(id: string, type: string, body: string | null): Promise<ApiResult<{ success: boolean }>> {
  return post(`/api/sales/prospects/${id}/activity`, { type, body });
}

export type ManagedPartner = {
  id: string;
  company_name: string | null;
  tier: string | null;
  status: string | null;
  onboarding_step: number | null;
  onboarding_completed: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  profiles: { full_name: string | null; email: string } | null;
  mtd_docs: number;
  mtd_revenue: number;
};

// The sales rep's managed partners with MTD stats (B2).
export function getPartners(): Promise<ApiResult<{ partners: ManagedPartner[] }>> {
  return get("/api/sales/partners");
}

export type SalesDashboard = {
  repName: string;
  userType: string;
  activePartners: number;
  onboardingPartners: number;
  mtdEvRevenue: number;
  mtdPlatformFees: number;
  stuckPartners: Array<{ id: string; company_name: string | null; onboarding_step: number | null; daysSinceUpdate: number }>;
  recentPartners: Array<{ id: string; company_name: string | null; tier: string | null; status: string | null; mtdDocs: number; mtdRevenue: number }>;
  leads: unknown[];
  pendingVerifications: Array<{ id: string; company_name: string | null; bar_number: string; tier: string | null; review_fee: number | null; created_at: string; profile_name: string; profile_email: string }>;
};

// The sales dashboard summary (B2).
export function getDashboard(): Promise<ApiResult<SalesDashboard>> {
  return get("/api/sales/dashboard");
}

export type RepSummary = {
  repId: string;
  repName: string;
  repEmail: string;
  commissionRate: number;
  mtdPlatformFees: number;
  mtdCommissionOwed: number;
  totalPartners: number;
  mtdPartners: number;
};

// Per-rep commission summary (B2, admin view).
export function getCommission(): Promise<ApiResult<{ repSummaries: RepSummary[]; totalMtdOwed: number; totalMtdFees: number }>> {
  return get("/api/sales/commission");
}

export type SalesOverview = {
  repName: string;
  activePartners: number;
  onboardingPartners: number;
  mtdRevenue: number;
  mtdCommission: number;
  stuckPartners: Array<{ id: string; company_name: string | null; onboarding_step: number | null; daysSinceUpdate: number }>;
  recentPartners: Array<{ id: string; company_name: string | null; tier: string | null; status: string | null; mtdDocs: number; mtdRevenue: number }>;
  leads: unknown[];
  pendingVerifications: Array<{ id: string; company_name: string | null; bar_number: string; tier: string | null; review_fee: number | null; created_at: string; profile_name: string; profile_email: string }>;
};

// The pro-portal sales overview (B2).
export function getOverview(): Promise<ApiResult<SalesOverview>> {
  return get("/api/sales/overview");
}

export type MyCommission = {
  breakdown: Array<{ partnerName: string; mtdRevenue: number; commission: number }>;
  mtdCommission: number;
  history: Array<{ month: string; partnerRevenue: number; commission: number; status: string }>;
};

// The signed-in rep's own commission breakdown + history (B2).
export function getMyCommission(): Promise<ApiResult<MyCommission>> {
  return get("/api/sales/my-commission");
}

export function createPartner(body: Record<string, unknown>): Promise<ApiResult<{ partnerId: string; tempPassword?: string }>> {
  return post("/api/sales/create-partner", body);
}

export function sendWelcomeEmail(body: Record<string, unknown>): Promise<ApiResult<{ success: boolean }>> {
  return post("/api/sales/send-welcome-email", body);
}

export function partnerLastLogin(partnerId: string): Promise<ApiResult<{ lastLogin: string | null }>> {
  return get("/api/sales/partner-last-login", { partnerId });
}

export function addPartnerNote(partnerId: string, note: string): Promise<ApiResult<{ success: boolean }>> {
  return post("/api/sales/partner-notes", { partnerId, note });
}

export type PartnerDetailResponse = {
  partner: Record<string, unknown>;
  performance: {
    mtdDocs: number; mtdRevenue: number;
    lmDocs: number; lmRevenue: number;
    allDocs: number; allRevenue: number;
    monthlyStats: { month: string; docs: number; revenue: number }[];
  };
  activity: { id: string; action: string; metadata: Record<string, unknown> | null; created_at: string }[];
  notes: { id: string; note: string; sales_rep_id: string | null; created_at: string }[];
};

// A managed partner's full detail (B2, ownership enforced server-side).
export function getPartnerDetail(partnerId: string): Promise<ApiResult<PartnerDetailResponse>> {
  return get(`/api/sales/partners/${partnerId}`);
}

// Toggle a managed partner's account status (B2).
export function setPartnerStatus(partnerId: string, status: "active" | "suspended"): Promise<ApiResult<{ success: boolean }>> {
  return patch(`/api/sales/partners/${partnerId}`, { status });
}

// Apply a promo code to a managed partner, comping the platform fee (B2).
export function applyPartnerPromo(partnerId: string, promoCode: string): Promise<ApiResult<{ success: boolean }>> {
  return post(`/api/sales/partners/${partnerId}/apply-promo`, { promo_code: promoCode });
}

export type MyPlatformCommission = {
  commissionRate: number;
  mtdCommission: number;
  breakdown: { partnerName: string; platformFee: number; commission: number; paidAt: string; status: string }[];
  history: { month: string; platformFees: number; commission: number; status: string }[];
};

// The signed-in rep's platform-fee commission breakdown + history (B2).
export function getMyPlatformCommission(): Promise<ApiResult<MyPlatformCommission>> {
  return get("/api/sales/my-platform-commission");
}

// Mark a professional lead's status (B2 sales dashboard).
export function setLeadStatus(leadId: string, status: "new" | "contacted"): Promise<ApiResult<{ success: boolean }>> {
  return patch(`/api/sales/leads/${leadId}`, { status });
}

// Activate or reject a pending attorney bar-verification (B2).
export function attorneyVerification(partnerId: string, action: "activate" | "reject"): Promise<ApiResult<{ success: boolean }>> {
  return post("/api/sales/attorney-verification", { partnerId, action });
}

export function getReps(): Promise<ApiResult<{ reps: unknown[] }>> {
  return get("/api/sales/reps");
}

export function updateRep(repId: string, commissionRate: number): Promise<ApiResult<{ success: boolean }>> {
  return patch("/api/sales/reps", { repId, commissionRate });
}

export function createRep(body: {
  fullName: string;
  email: string;
  commissionRate: number;
}): Promise<ApiResult<{ success: boolean }>> {
  return post("/api/sales/create-rep", body);
}

export function affiliatePayout(affiliateId: string): Promise<ApiResult<{ success: boolean }>> {
  return post(`/api/sales/affiliates/${affiliateId}/payout`);
}

export function affiliateStatus(affiliateId: string, status: string): Promise<ApiResult<{ success: boolean }>> {
  return post(`/api/sales/affiliates/${affiliateId}/status`, { status });
}

export function getTestPromo(): Promise<ApiResult<{ active: boolean }>> {
  return get("/api/admin/test-promo");
}

export function setTestPromo(active: boolean): Promise<ApiResult<{ success: boolean }>> {
  return post("/api/admin/test-promo", { active });
}

export function getFarewellVerifications(): Promise<ApiResult<{ requests: unknown[] }>> {
  return get("/api/admin/farewell-verification");
}

export function farewellVerification(body: {
  requestId: string;
  action: string;
  notes?: string;
}): Promise<ApiResult<{ success: boolean }>> {
  return post("/api/admin/farewell-verification", body);
}

export function getOrdersMissingDocs(): Promise<ApiResult<{ orders: unknown[] }>> {
  return get("/api/admin/orders-missing-docs");
}

export function getMarketingMaterials(partnerSlug?: string): Promise<ApiResult<{ materials: unknown[] }>> {
  return get("/api/admin/marketing/materials", partnerSlug ? { partnerSlug } : undefined);
}

export function deleteMarketingMaterial(id: string): Promise<ApiResult<{ success: boolean }>> {
  return del(`/api/admin/marketing/materials/${id}`);
}

export function getMarketingPartners(): Promise<ApiResult<{ partners: unknown[] }>> {
  return get("/api/admin/marketing/partners");
}

export function sendPartnerActivatedEmail(body: {
  email: string;
  name: string;
}): Promise<ApiResult<{ success: boolean }>> {
  return post("/api/email/partner-activated", body);
}
