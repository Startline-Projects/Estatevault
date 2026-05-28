import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { sendDocumentEmail } from "@/lib/email";
import { wantsNotification } from "@/lib/notifications/prefs";
import * as attorneyReviewRepo from "@/lib/repos/server/attorneyReviewRepo";
import * as auditLogRepo from "@/lib/repos/server/auditLogRepo";

export const POST = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["review_attorney", "admin"]);
  if ("error" in auth) return auth.error;

  const { reviewId, decision, notes } = await req.json();
  if (!reviewId || !decision) return fail("Missing reviewId or decision", 400);

  const validDecisions = ["approved", "approved_with_notes", "flagged"];
  if (!validDecisions.includes(decision)) return fail("Invalid decision", 400);

  const isAdmin = auth.profile.user_type === "admin";

  const { data: review } = await attorneyReviewRepo.getById(auth.admin, reviewId);
  if (!review) return fail("Review not found", 404);
  if (!isAdmin && review.attorney_id !== auth.user.id) return fail("Forbidden", 403);

  const { error: reviewErr } = await attorneyReviewRepo.updateDecision(auth.admin, reviewId, decision, notes || null);
  if (reviewErr) return fail("Failed to update review", 500);

  if (decision === "approved" || decision === "approved_with_notes") {
    const { error: orderErr } = await auth.admin
      .from("orders")
      .update({ status: "delivered" })
      .eq("id", review.order_id);
    if (orderErr) return fail("Failed to unlock order", 500);

    const { error: docsErr } = await auth.admin
      .from("documents")
      .update({ status: "delivered", delivered_at: new Date().toISOString() })
      .eq("order_id", review.order_id);
    if (docsErr) return fail("Failed to unlock documents", 500);

    const { data: order } = await auth.admin
      .from("orders")
      .select("product_type, client_id, partner_id")
      .eq("id", review.order_id)
      .single();

    let clientEmail: string | null = null;
    let clientProfileId: string | null = null;
    let productType: "will" | "trust" = "will";

    if (order) {
      productType = (order.product_type as "will" | "trust") || "will";
      const { data: client } = await auth.admin
        .from("clients")
        .select("profile_id")
        .eq("id", order.client_id)
        .single();

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
      const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://www.estatevault.us";
      await sendDocumentEmail({
        to: clientEmail,
        productType,
        loginLink: `${origin}/auth/login?email=${encodeURIComponent(clientEmail)}`,
        partnerId: order?.partner_id,
      });
      await auditLogRepo.insertEntry(auth.admin, {
        action: "email.documents_delivered_after_review",
        resource_type: "order",
        resource_id: review.order_id,
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
