import { get, post, getRaw, type ApiResult } from "./client";

export type CheckStatusResult = {
  status: string;
  documents?: Array<{ id: string; document_type: string; status: string }>;
};

export type DownloadBySessionResult = { url: string };

export function processNow(orderId: string): Promise<ApiResult<unknown>> {
  return get("/api/documents/process-now", { order_id: orderId });
}

export function checkStatus(orderId: string): Promise<ApiResult<CheckStatusResult>> {
  return get("/api/documents/check-status", { order_id: orderId });
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

export function sendEmail(): Promise<ApiResult<{ success: boolean }>> {
  return post("/api/documents/send-email");
}
