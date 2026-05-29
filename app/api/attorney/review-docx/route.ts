import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { getDocumentDownloadUrl } from "@/lib/documents/storage";
import * as attorneyReviewRepo from "@/lib/repos/server/attorneyReviewRepo";
import * as auditLogRepo from "@/lib/repos/server/auditLogRepo";

export const GET = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["review_attorney", "admin"]);
  if ("error" in auth) return auth.error;

  const documentId = new URL(req.url).searchParams.get("documentId");
  if (!documentId) return fail("Missing documentId", 400);

  const { data: doc } = await auth.admin
    .from("documents")
    .select("order_id, document_type, review_docx_path, review_docx_for")
    .eq("id", documentId)
    .single();
  if (!doc || !doc.review_docx_path) return fail("No editable document available.", 404);

  const isAdmin = auth.profile.user_type === "admin";
  if (!doc.order_id) return fail("Document has no associated order", 400);
  const { data: ar } = await attorneyReviewRepo.isAssignedAttorney(auth.admin, doc.order_id, auth.user.id);

  if (!isAdmin && !ar) return fail("Forbidden", 403);

  const sealed = !!doc.review_docx_for;
  if (sealed && doc.review_docx_for !== auth.user.id) {
    return fail("This editable copy is sealed to a different attorney.", 403);
  }

  const url = await getDocumentDownloadUrl(doc.review_docx_path);
  if (!url) return fail("File not available", 404);

  await auditLogRepo.insertEntry(auth.admin, {
    actor_id: auth.user.id,
    action: "document.review_docx_downloaded",
    resource_type: "document",
    resource_id: documentId,
    metadata: { document_type: doc.document_type, sealed },
  });

  return ok({ url, sealed, filename: `${doc.document_type}.docx` });
});
