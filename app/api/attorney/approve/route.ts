import { NextRequest } from "next/server";
import { getAppUrl } from "@/lib/config/appUrl";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { sendDocumentEmail } from "@/lib/email";
import { wantsNotification } from "@/lib/notifications/prefs";
import * as attorneyReviewRepo from "@/lib/repos/server/attorneyReviewRepo";
import * as auditLogRepo from "@/lib/repos/server/auditLogRepo";
import { attorneyApproveSchema } from "@/lib/validation/schemas";

export const POST = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["review_attorney"]);
  if ("error" in auth) return auth.error;

  const rawBody = await req.json();
  const parsedApprove = attorneyApproveSchema.safeParse(rawBody);
  if (!parsedApprove.success) return fail("invalid payload", 400);
  const { reviewId } = parsedApprove.data;
  const rawBodyTyped = rawBody as Record<string, unknown>;
  const decision = typeof rawBodyTyped.decision === "string" ? rawBodyTyped.decision : undefined;
  const notes = typeof rawBodyTyped.notes === "string" ? rawBodyTyped.notes : undefined;
  if (!decision) return fail("Missing reviewId or decision", 400);

  const validDecisions = ["approved", "approved_with_notes", "flagged"];
  if (!validDecisions.includes(decision)) return fail("Invalid decision", 400);

  const { data: review } = await attorneyReviewRepo.getById(auth.admin, reviewId);
  if (!review) return fail("Review not found", 404);
  if (review.attorney_id !== auth.user.id) return fail("Forbidden", 403);

  // BUG-53: a decided review is terminal — block repeat approvals (and the duplicate delivery emails they send).
  const terminalStates = ["approved", "approved_with_notes", "flagged"];
  if (review.status && terminalStates.includes(review.status)) return fail("Review already decided", 409);

  // BUG-53: a paid review can't be "delivered" with nothing to show — require a generated document exists.
  // Upload is OPTIONAL: if the attorney approves without uploading an edited file, the client receives the
  // originally generated PDF (the download route falls back to storage_path when reviewed_path is null).
  if (decision === "approved" || decision === "approved_with_notes") {
    if (!review.order_id) return fail("Review has no associated order", 400);
    const { count, error: cntErr } = await auth.admin
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("order_id", review.order_id)
      .not("storage_path", "is", null);
    if (cntErr) return fail("Failed to verify documents", 500);
    if (!count) return fail("No generated document found for this order", 400);
  }

  const { error: reviewErr } = await attorneyReviewRepo.updateDecision(auth.admin, reviewId, decision, notes || null);
  if (reviewErr) return fail("Failed to update review", 500);

  if (decision === "approved" || decision === "approved_with_notes") {
    if (!review.order_id) return fail("Review has no associated order", 400);
    const orderId = review.order_id;

    const { error: orderErr } = await auth.admin
      .from("orders")
      .update({ status: "delivered" })
      .eq("id", orderId);
    if (orderErr) return fail("Failed to unlock order", 500);

    const { error: docsErr } = await auth.admin
      .from("documents")
      .update({ status: "delivered", delivered_at: new Date().toISOString() })
      .eq("order_id", orderId);
    if (docsErr) return fail("Failed to unlock documents", 500);

    const { data: order } = await auth.admin
      .from("orders")
      .select("product_type, client_id, partner_id")
      .eq("id", orderId)
      .single();

    let clientEmail: string | null = null;
    let clientProfileId: string | null = null;
    let productType: "will" | "trust" = "will";

    if (order) {
      productType = (order.product_type as "will" | "trust") || "will";
      const { data: client } = order.client_id ? await auth.admin
        .from("clients")
        .select("profile_id")
        .eq("id", order.client_id)
        .single() : { data: null };

      if (client?.profile_id) {
        clientProfileId = client.profile_id;
        const { data: clientProfile } = await auth.admin
          .from("profiles")
          .select("email")
          .eq("id", client.profile_id)
          .single();
        clientEmail = clientProfile?.email || null;
      }
    }

    const wantsDelivery = clientEmail
      ? await wantsNotification(auth.admin, clientProfileId, "documents_delivered")
      : false;
    if (clientEmail && wantsDelivery) {
      const origin = getAppUrl();
      await sendDocumentEmail({
        to: clientEmail,
        productType,
        loginLink: `${origin}/auth/login?email=${encodeURIComponent(clientEmail)}`,
        partnerId: order?.partner_id,
      });
      await auditLogRepo.insertEntry(auth.admin, {
        action: "email.documents_delivered_after_review",
        resource_type: "order",
        resource_id: orderId,
      });
    }
  }

  await auditLogRepo.insertEntry(auth.admin, {
    actor_id: auth.user.id,
    action: `attorney_review.${decision}`,
    resource_type: "attorney_review",
    resource_id: reviewId,
    metadata: { notes: notes || null, order_id: review.order_id },
  });

  return ok({ success: true });
});
