import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok } from "@/lib/api/response";
import * as attorneyReviewRepo from "@/lib/repos/server/attorneyReviewRepo";
import * as orderRepo from "@/lib/repos/server/orderRepo";
import * as clientRepo from "@/lib/repos/server/clientRepo";
import * as profileRepo from "@/lib/repos/server/profileRepo";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";

// B2: the signed-in attorney's review queue, assembled server-side (was a chain
// of direct client-side supabase reads in app/attorney/reviews).
export const GET = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["review_attorney", "attorney"], req);
  if ("error" in auth) return auth.error;

  const { data: me } = await profileRepo.getMeById(auth.admin, auth.user.id);
  const userName = me?.full_name || me?.email || "Attorney";

  const { data: rawReviews } = await attorneyReviewRepo.listByAttorney(auth.admin, auth.user.id);
  if (!rawReviews || rawReviews.length === 0) {
    return ok({ reviews: [], userName });
  }

  const orderIds = rawReviews.map((r) => r.order_id).filter((x): x is string => x != null);
  const { data: orders } = await orderRepo.listByIds(auth.admin, orderIds);
  const orderMap = Object.fromEntries((orders ?? []).map((o) => [o.id, o]));

  const clientIds = (orders ?? []).map((o) => o.client_id).filter((x): x is string => x != null);
  const { data: clients } = clientIds.length ? await clientRepo.listByIds(auth.admin, clientIds) : { data: [] };
  const clientMap = Object.fromEntries((clients ?? []).map((c) => [c.id, c]));

  const profileIds = (clients ?? []).map((c) => c.profile_id).filter((x): x is string => x != null);
  const { data: clientProfiles } = profileIds.length ? await profileRepo.listByIds(auth.admin, profileIds) : { data: [] };
  const profileMap = Object.fromEntries((clientProfiles ?? []).map((p) => [p.id, p]));

  const partnerIds = rawReviews.map((r) => r.partner_id).filter((x): x is string => x != null);
  const { data: partners } = partnerIds.length ? await partnerRepo.listCompanyByIds(auth.admin, partnerIds) : { data: [] };
  const partnerMap = Object.fromEntries((partners ?? []).map((p) => [p.id, p]));

  const reviews = rawReviews.map((r) => {
    const order = r.order_id != null ? orderMap[r.order_id] ?? null : null;
    const client = order && order.client_id != null ? clientMap[order.client_id] : null;
    const clientProfile = client && client.profile_id != null ? profileMap[client.profile_id] : null;
    const partner = r.partner_id ? partnerMap[r.partner_id] : null;
    return {
      ...r,
      product_type: order?.product_type || "will",
      partner_company: partner?.company_name || null,
      client_name: clientProfile?.full_name || clientProfile?.email || null,
      client_email: clientProfile?.email || null,
    };
  });

  return ok({ reviews, userName });
});
