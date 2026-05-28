export const dynamic = "force-dynamic";

import { type NextRequest } from "next/server";
import { addJob, type DocumentJob } from "@/lib/queue/document-queue";
import { randomUUID } from "crypto";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { requireAuth, assertOrderAccess } from "@/lib/api/auth";
import { apiRateLimit } from "@/lib/rate-limit";
import * as quizSessionRepo from "@/lib/repos/server/quizSessionRepo";
import * as orderRepo from "@/lib/repos/server/orderRepo";
import * as auditLogRepo from "@/lib/repos/server/auditLogRepo";

export const POST = withRoute(async (request: NextRequest) => {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const { admin, profile } = auth;

  const { order_id } = await request.json();
  if (!order_id || typeof order_id !== "string") {
    return fail("Missing order_id", 400);
  }

  const access = await assertOrderAccess(admin, order_id, profile);
  if ("error" in access) return access.error;

  const { success: rlOk } = await apiRateLimit.limit(`gen:${profile.id}:${order_id}`);
  if (!rlOk) return fail("rate limit exceeded", 429);

  const { data: order } = await admin
    .from("orders")
    .select("*, clients(id, partner_id)")
    .eq("id", order_id)
    .single();
  if (!order) return fail("Order not found", 404);

  const { data: quiz } = await quizSessionRepo.getLatestAnswersByClient(admin, order.client_id)
    .then(r => r, () => ({ data: null }));

  const documentTypes = order.product_type === "trust"
    ? ["trust", "pour_over_will", "poa", "healthcare_directive"]
    : ["will", "poa", "healthcare_directive"];

  const job: DocumentJob = {
    job_id: randomUUID(),
    order_id,
    client_id: order.client_id,
    document_types: documentTypes,
    intake_answers: (quiz?.answers as Record<string, unknown>) || {},
    product_type: order.product_type,
    partner_id: order.partner_id || undefined,
    attorney_review: order.attorney_review_requested || false,
    status: "queued",
    created_at: new Date().toISOString(),
    started_at: null,
    completed_at: null,
    attempts: 0,
    error: null,
  };

  await addJob(job);
  await orderRepo.update(admin, order_id, { status: "generating" });
  await auditLogRepo.insertEntry(admin, {
    action: "documents.generation_queued",
    resource_type: "order",
    resource_id: order_id,
    metadata: { job_id: job.job_id, document_types: documentTypes },
  });

  return ok({ job_id: job.job_id });
});
