import { post, get, patch, del, type ApiResult } from "./client";

export function createPartner(body: Record<string, unknown>): Promise<ApiResult<{ partnerId: string; tempPassword?: string }>> {
  return post("/api/sales/create-partner", body);
}

export function sendWelcomeEmail(body: Record<string, unknown>): Promise<ApiResult<{ success: boolean }>> {
  return post("/api/sales/send-welcome-email", body);
}

export function partnerLastLogin(partnerId: string): Promise<ApiResult<{ lastLogin: string | null }>> {
  return get("/api/sales/partner-last-login", { partnerId });
}

export function addPartnerNote(partnerId: string, content: string): Promise<ApiResult<{ success: boolean }>> {
  return post("/api/sales/partner-notes", { partnerId, content });
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
