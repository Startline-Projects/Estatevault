import { get, post, getRaw, publicGet, type ApiResult } from "./client";

export type CheckStatusResult = {
  ready?: boolean;
  status?: string;
  documents?: Array<{ id: string; document_type: string; status: string; has_file?: boolean }>;
};

export type DownloadBySessionResult = { url: string };

// Called from the public, post-payment success page where the visitor has no
// session yet (account is created on that page). Must use publicGet — authed
// get() would redirect the whole window to /auth/login on a 401.
export function processNow(orderId: string): Promise<ApiResult<unknown>> {
  return publicGet("/api/documents/process-now", { order_id: orderId });
}

export function checkStatus(orderId: string): Promise<ApiResult<CheckStatusResult>> {
  return publicGet("/api/documents/check-status", { order_id: orderId });
}

export function downloadBySession(params: {
  id: string;
  session_id?: string;
  order_id?: string;
}): Promise<ApiResult<DownloadBySessionResult>> {
  return get("/api/documents/download-by-session", params);
}

export function downloadZip(params: {
  order_id: string;
  first_name?: string;
  last_name?: string;
}): Promise<Response> {
  return getRaw("/api/documents/download-zip", params);
}

export function regenerateMissing(orderId: string): Promise<ApiResult<unknown>> {
  return get("/api/documents/regenerate-missing", { order_id: orderId });
}

// Re-run full fulfillment from the verified Stripe session for a paid-but-stuck
// order (webhook missed / generation failed) that has no document rows yet.
export function retryFulfillment(orderId: string): Promise<ApiResult<{ action: string }>> {
  return post("/api/admin/retry-fulfillment", { order_id: orderId });
}

export function sendEmail(): Promise<ApiResult<{ success: boolean }>> {
  return post("/api/documents/send-email");
}

export type MyDocumentsResult = {
  clientId: string | null;
  latestOrder: { id: string; product_type: string; status: string; attorney_review_requested: boolean | null } | null;
  documents: Array<{
    id: string;
    document_type: string;
    status: string;
    storage_path: string | null;
    generated_at: string | null;
    delivered_at: string | null;
  }>;
};

// The signed-in client's own documents + latest order (B2).
export function getMyDocuments(): Promise<ApiResult<MyDocumentsResult>> {
  return get("/api/client/documents");
}
