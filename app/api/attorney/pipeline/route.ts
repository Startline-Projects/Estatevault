import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok } from "@/lib/api/response";
import * as attorneyReviewRepo from "@/lib/repos/server/attorneyReviewRepo";
import * as orderRepo from "@/lib/repos/server/orderRepo";
import * as clientRepo from "@/lib/repos/server/clientRepo";
import * as profileRepo from "@/lib/repos/server/profileRepo";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";

// B2: the attorney's review pipeline (partner resolved via order.partner_id),
// assembled server-side. Was a chain of direct client-side supabase reads.
export const GET = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["review_attorney", "attorney"], req);
  if ("error" in auth) return auth.error;

  const { data: raw } = await attorneyReviewRepo.listByAttorney(auth.admin, auth.user.id);
  if (!raw || raw.length === 0) return ok({ cases: [] });

  const orderIds = raw.map((r) => r.order_id).filter((x): x is string => x != null);
  const { data: orders } = await orderRepo.listByIds(auth.admin, orderIds);
  const orderMap = Object.fromEntries((orders ?? []).map((o) => [o.id, o]));

  const clientIds = (orders ?? []).map((o) => o.client_id).filter((x): x is string => x != null);
  const { data: clients } = clientIds.length ? await clientRepo.listByIds(auth.admin, clientIds) : { data: [] };
  const clientMap = Object.fromEntries((clients ?? []).map((c) => [c.id, c]));

  const profileIds = (clients ?? []).map((c) => c.profile_id).filter((x): x is string => x != null);
  const { data: profs } = profileIds.length ? await profileRepo.listByIds(auth.admin, profileIds) : { data: [] };
  const profMap = Object.fromEntries((profs ?? []).map((p) => [p.id, p]));

  const partnerIds = (orders ?? []).map((o) => o.partner_id).filter((x): x is string => x != null);
  const { data: partners } = partnerIds.length ? await partnerRepo.listCompanyByIds(auth.admin, partnerIds) : { data: [] };
  const partnerMap = Object.fromEntries((partners ?? []).map((p) => [p.id, p]));

  const cases = raw.map((r) => {
    const o = r.order_id != null ? orderMap[r.order_id] : undefined;
    const c = o && o.client_id != null ? clientMap[o.client_id] : null;
    const prof = c && c.profile_id != null ? profMap[c.profile_id] : null;
    const partner = o?.partner_id ? partnerMap[o.partner_id] : null;
    return {
      ...r,
      product_type: o?.product_type || "will",
      partner_company: partner?.company_name || null,
      client_name: prof?.full_name || prof?.email || null,
      client_email: prof?.email || null,
    };
  });

  return ok({ cases });
});
