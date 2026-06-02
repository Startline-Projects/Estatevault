import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok } from "@/lib/api/response";
import * as clientRepo from "@/lib/repos/server/clientRepo";
import * as orderRepo from "@/lib/repos/server/orderRepo";
import * as documentRepo from "@/lib/repos/server/documentRepo";

// B2: the signed-in client's own documents + latest order (was a direct
// client-side supabase read in app/dashboard/documents).
export const GET = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(undefined, req);
  if ("error" in auth) return auth.error;

  const { data: client } = await clientRepo.getIdByProfile(auth.admin, auth.user.id);
  if (!client) return ok({ clientId: null, latestOrder: null, documents: [] });

  const [{ data: orders }, { data: documents }] = await Promise.all([
    orderRepo.latestByClient(auth.admin, client.id),
    documentRepo.listByClientWithFiles(auth.admin, client.id),
  ]);

  return ok({
    clientId: client.id,
    latestOrder: orders?.[0] ?? null,
    documents: documents ?? [],
  });
});
