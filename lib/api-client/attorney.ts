import { get, patch, type ApiResult } from "./client";

export type AttorneyReview = {
  id: string;
  order_id: string | null;
  status: string | null;
  sla_deadline: string | null;
  created_at: string | null;
  reviewer_type: string | null;
  fee_destination: string | null;
  fee_amount: number | null;
  partner_id: string | null;
  product_type: string;
  partner_company: string | null;
  client_name: string | null;
  client_email: string | null;
};

// The signed-in attorney's review queue (B2).
export function getReviews(): Promise<ApiResult<{ reviews: AttorneyReview[]; userName: string }>> {
  return get("/api/attorney/reviews");
}

export type PipelineCase = {
  id: string;
  order_id: string | null;
  status: string | null;
  sla_deadline: string | null;
  created_at: string | null;
  product_type: string;
  partner_company: string | null;
  client_name: string | null;
  client_email: string | null;
};

// The attorney's review pipeline (B2).
export function getPipeline(): Promise<ApiResult<{ cases: PipelineCase[] }>> {
  return get("/api/attorney/pipeline");
}

// Move a review's status (B2).
export function updateReviewStatus(reviewId: string, status: string): Promise<ApiResult<{ success: boolean }>> {
  return patch(`/api/attorney/reviews/${reviewId}`, { status });
}
