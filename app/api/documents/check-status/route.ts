import { type NextRequest, type NextResponse } from "next/server";
import { requireAuth, assertOrderAccess } from "@/lib/api/auth";
import { ok, fail } from "@/lib/api/response";
import { withRoute } from "@/lib/api/route";

export const GET = withRoute(async (req: NextRequest): Promise<NextResponse> => {
  const auth = await requireAuth(undefined, req);
  if ("error" in auth) return auth.error;

  const orderId = new URL(req.url).searchParams.get("order_id");
  if (!orderId) return fail("Missing order_id", 400);

  const access = await assertOrderAccess(auth.admin, orderId, auth.profile);
  if ("error" in access) return access.error;

  const { data: docs } = await auth.admin
    .from("documents")
    .select("id, document_type, status, storage_path")
    .eq("order_id", orderId);

  if (!docs || docs.length === 0) {
    return ok({ ready: false, documents: [] });
  }

  const allReady = docs.every((d: { status: string | null }) => d.status === "generated" || d.status === "delivered");

  return ok({
    ready: allReady,
    documents: docs.map((d: { id: string; document_type: string; status: string | null; storage_path: string | null }) => ({
      id: d.id,
      document_type: d.document_type,
      status: d.status,
      has_file: !!d.storage_path,
    })),
  });
});
