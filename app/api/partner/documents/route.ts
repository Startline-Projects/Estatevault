import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok } from "@/lib/api/response";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";
import * as orderRepo from "@/lib/repos/server/orderRepo";

// B2: the signed-in partner's document orders with client names (was a direct
// client-side supabase read + N+1 in app/pro/documents).
export const GET = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["partner"], req);
  if ("error" in auth) return auth.error;

  const { data: partner } = await partnerRepo.getByProfileId(auth.admin, auth.profile.id);
  if (!partner) return ok({ orders: [] });

  const { data: orders } = await orderRepo.listByPartnerWithClient(auth.admin, partner.id);
  return ok({ orders: orders ?? [] });
});
