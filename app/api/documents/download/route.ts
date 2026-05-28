import { type NextRequest } from "next/server";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { requireAuth, createAdminClient } from "@/lib/api/auth";
import { getDocumentDownloadUrl } from "@/lib/documents/storage";
import * as auditLogRepo from "@/lib/repos/server/auditLogRepo";

export const GET = withRoute(async (request: NextRequest) => {
  const auth = await requireAuth(undefined, request);
  if ("error" in auth) return auth.error;
  const { user, profile, admin } = auth;

  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get("id");
  if (!documentId) return fail("Missing document id", 400);

  const { data: doc } = await admin
    .from("documents")
    .select("storage_path, client_id, order_id, sealed, sealed_for_user_id, attorney_sealed_path, attorney_sealed_for")
    .eq("id", documentId)
    .single();
  if (!doc || !doc.storage_path) return fail("Document not found", 404);

  let reviewedPath: string | null = null;
  let reviewedSealed = false;
  const { data: rev } = await admin
    .from("documents")
    .select("reviewed_path, reviewed_sealed")
    .eq("id", documentId)
    .maybeSingle();
  if (rev) {
    reviewedPath = rev.reviewed_path ?? null;
    reviewedSealed = !!rev.reviewed_sealed;
  }

  const { data: client } = await admin
    .from("clients")
    .select("profile_id, partner_id")
    .eq("id", doc.client_id)
    .single();
  if (!client) return fail("Access denied", 403);

  const isClient = client.profile_id === user.id;
  let isPartner = false;
  if (client.partner_id) {
    const { data: partner } = await admin
      .from("partners")
      .select("profile_id")
      .eq("id", client.partner_id)
      .single();
    if (partner?.profile_id === user.id) isPartner = true;
  }

  const isAdmin = profile.user_type === "admin";

  let isReviewAttorney = false;
  if (profile.user_type === "review_attorney") {
    const { data: ar } = await admin
      .from("attorney_reviews")
      .select("id")
      .eq("order_id", doc.order_id)
      .eq("attorney_id", user.id)
      .single();
    if (ar) isReviewAttorney = true;
  }

  if (!isClient && !isPartner && !isAdmin && !isReviewAttorney) {
    return fail("Access denied", 403);
  }

  if (isClient && !isAdmin) {
    const { data: order } = await admin
      .from("orders")
      .select("status, attorney_review_requested")
      .eq("id", doc.order_id)
      .single();
    if (order?.attorney_review_requested && order.status !== "delivered") {
      return fail("Documents are under attorney review and will be available once approved.", 403);
    }
  }

  let path = doc.storage_path as string;
  let sealed = !!doc.sealed;
  if (isReviewAttorney) {
    if (doc.sealed && doc.attorney_sealed_path && doc.attorney_sealed_for === user.id) {
      path = doc.attorney_sealed_path as string;
    }
  } else if (reviewedPath) {
    path = reviewedPath;
    sealed = reviewedSealed;
  }

  const url = await getDocumentDownloadUrl(path);
  if (!url) return fail("File not available", 404);

  await auditLogRepo.insertEntry(admin, {
    actor_id: user.id,
    action: "document.downloaded",
    resource_type: "document",
    resource_id: documentId,
    metadata: { sealed, reviewed: !isReviewAttorney && !!reviewedPath },
  });

  return ok({ url, sealed, encVersion: 1 });
});
