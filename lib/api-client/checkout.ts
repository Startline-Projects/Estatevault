import { post, get, publicPost, publicGet, type ApiResult } from "./client";

export type CheckoutUrlResult = { url: string };
export type FreeCheckoutResult = { orderId: string; status?: string; redirect?: string };
export type CheckConflictResult = { conflict: boolean; existingOrderId?: string };
export type VerifySessionResult = { orderId: string; status: string; clientId?: string; productType?: string };

export function checkoutWill(body: Record<string, unknown>): Promise<ApiResult<CheckoutUrlResult | FreeCheckoutResult>> {
  return publicPost("/api/checkout/will", body);
}

export function checkoutTrust(body: Record<string, unknown>): Promise<ApiResult<CheckoutUrlResult | FreeCheckoutResult>> {
  return publicPost("/api/checkout/trust", body);
}

export function checkConflict(email: string, productType: string): Promise<ApiResult<CheckConflictResult>> {
  return publicPost("/api/checkout/check-conflict", { email, productType });
}

export function verifySession(sessionId: string): Promise<ApiResult<VerifySessionResult>> {
  return publicGet("/api/checkout/verify", { session_id: sessionId });
}

export function checkoutAmendment(body: {
  userId: string;
  changeType: string;
  description: string;
}): Promise<ApiResult<CheckoutUrlResult | { redirect: string }>> {
  return post("/api/checkout/amendment", body);
}

export function checkoutVaultSubscription(body?: Record<string, unknown>): Promise<ApiResult<CheckoutUrlResult>> {
  return post("/api/checkout/vault-subscription", body);
}

export function checkoutPartner(partnerId: string, tier: string): Promise<ApiResult<CheckoutUrlResult>> {
  return post("/api/checkout/partner", { partnerId, tier });
}

export function checkoutAttorney(body: Record<string, unknown>): Promise<ApiResult<CheckoutUrlResult | FreeCheckoutResult>> {
  return publicPost("/api/checkout/attorney", body);
}

export function verifyAttorneyCheckout(sessionId: string, password: string): Promise<ApiResult<{ success: boolean }>> {
  return publicPost("/api/checkout/attorney/verify", { session_id: sessionId, password });
}
