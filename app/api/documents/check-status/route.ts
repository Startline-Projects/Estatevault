import { type NextRequest, type NextResponse } from "next/server";
import { createAdminClient } from "@/lib/api/auth";
import { ok, fail } from "@/lib/api/response";
import { withRoute } from "@/lib/api/route";

// Public read-only document-readiness poll for the post-payment success page
// (the visitor has no session yet). Listed in middleware publicPaths. Returns
// only non-sensitive status fields keyed by an opaque order UUID.
export const GET = withRoute(async (req: NextRequest): Promise<NextResponse> => {
  const orderId = new URL(req.url).searchParams.get("order_id");
  if (!orderId) return fail("Missing order_id", 400);

  const admin = createAdminClient();

  const { data: docs } = await admin
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
