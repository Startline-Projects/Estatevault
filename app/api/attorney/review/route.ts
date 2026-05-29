import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import * as attorneyReviewRepo from "@/lib/repos/server/attorneyReviewRepo";

export const GET = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["review_attorney", "admin"]);
  if ("error" in auth) return auth.error;

  const reviewId = new URL(req.url).searchParams.get("id");
  if (!reviewId) return fail("Missing id", 400);

  const isAdmin = auth.profile.user_type === "admin";

  const { data: review } = await attorneyReviewRepo.getById(auth.admin, reviewId);
  if (!review) return fail("Review not found", 404);

  if (!isAdmin && review.attorney_id !== auth.user.id) return fail("Forbidden", 403);
  if (!review.order_id) return fail("Review has no associated order", 400);
  const reviewOrderId = review.order_id;

  const { data: order } = await auth.admin
    .from("orders")
    .select("id, product_type, client_id, amount_total")
    .eq("id", reviewOrderId)
    .single();

  let clientName: string | null = null;
  let clientEmail: string | null = null;
  if (order?.client_id) {
    const { data: client } = await auth.admin
      .from("clients")
      .select("id, profile_id")
      .eq("id", order.client_id)
      .single();

    if (client?.profile_id) {
      const { data: clientProfile } = await auth.admin
        .from("profiles")
        .select("full_name, email")
        .eq("id", client.profile_id)
        .single();
      clientName = clientProfile?.full_name || clientProfile?.email || null;
      clientEmail = clientProfile?.email || null;
    }
  }

  let partnerCompany: string | null = null;
  if (review.partner_id) {
    const { data: partner } = await auth.admin
      .from("partners")
      .select("company_name")
      .eq("id", review.partner_id)
      .single();
    partnerCompany = partner?.company_name || null;
  }

  const { data: documents } = await auth.admin
    .from("documents")
    .select("id, document_type, storage_path, status")
    .eq("order_id", reviewOrderId)
    .order("created_at", { ascending: true });

  const extra: Record<string, { review_docx_path: string | null; reviewed_path: string | null; reviewed_uploaded_at: string | null }> = {};
  const { data: extDocs } = await auth.admin
    .from("documents")
    .select("id, review_docx_path, reviewed_path, reviewed_uploaded_at")
    .eq("order_id", reviewOrderId);
  if (extDocs) for (const e of extDocs) extra[e.id] = e;

  return ok({
    review: {
      id: review.id,
      order_id: review.order_id,
      status: review.status,
      sla_deadline: review.sla_deadline,
      created_at: review.created_at,
    },
    order: {
      product_type: order?.product_type || "will",
      amount_total: order?.amount_total || 0,
    },
    client: { name: clientName, email: clientEmail },
    partner: { company: partnerCompany },
    documents: (documents || []).map((d) => ({
      id: d.id,
      document_type: d.document_type,
      storage_path: d.storage_path,
      status: d.status,
      has_editable_docx: !!extra[d.id]?.review_docx_path,
      reviewed_uploaded: !!extra[d.id]?.reviewed_path,
      reviewed_uploaded_at: extra[d.id]?.reviewed_uploaded_at || null,
    })),
  });
});
