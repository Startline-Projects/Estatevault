import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";
import * as clientRepo from "@/lib/repos/server/clientRepo";
import * as orderRepo from "@/lib/repos/server/orderRepo";
import * as documentRepo from "@/lib/repos/server/documentRepo";
import * as auditLogRepo from "@/lib/repos/server/auditLogRepo";

// B2: a single client's detail for the pro client-detail page. Adds the
// ownership check the client-side version lacked — the client must belong to
// the signed-in partner.
export const GET = withRoute(async (
  req: NextRequest,
  { params }: { params: { clientId: string } },
) => {
  const auth = await requireAuth(["partner"], req);
  if ("error" in auth) return auth.error;

  const { data: partner } = await partnerRepo.getByProfileId(auth.admin, auth.profile.id);
  if (!partner) return fail("forbidden", 403);

  const { data: client } = await clientRepo.getDetailById(auth.admin, params.clientId);
  if (!client) return fail("not found", 404);
  if (client.partner_id !== partner.id) return fail("forbidden", 403);

  const [{ data: orders }, { data: docs }, { data: notes }, { data: activity }] = await Promise.all([
    orderRepo.listByClient(auth.admin, params.clientId),
    documentRepo.listByClient(auth.admin, params.clientId),
    clientRepo.listNotes(auth.admin, params.clientId),
    auditLogRepo.listByResource(auth.admin, params.clientId, 20),
  ]);

  return ok({
    client,
    orders: orders ?? [],
    docs: docs ?? [],
    notes: notes ?? [],
    activity: activity ?? [],
  });
});
