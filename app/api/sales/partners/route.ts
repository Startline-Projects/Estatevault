import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok } from "@/lib/api/response";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";
import * as orderRepo from "@/lib/repos/server/orderRepo";

// B2: the sales rep's managed partners with MTD doc count + revenue (was a
// direct client-side supabase read + N+1 in app/sales/partners). Admins and
// review attorneys see all partners.
export const GET = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["sales_rep", "admin", "review_attorney"], req);
  if ("error" in auth) return auth.error;

  const isAdmin = auth.profile.user_type === "admin" || auth.profile.user_type === "review_attorney";
  const { data: partners } = await partnerRepo.listManaged(auth.admin, isAdmin ? null : auth.user.id);

  const mtdStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const enriched = await Promise.all(
    (partners ?? []).map(async (p) => {
      const { data: orders } = await orderRepo.listSinceByPartner(auth.admin, p.id, mtdStart);
      const mtdDocs = orders?.length ?? 0;
      const mtdRevenue = (orders ?? []).reduce((s, o) => s + (o.partner_cut || 0), 0);
      return { ...p, mtd_docs: mtdDocs, mtd_revenue: mtdRevenue };
    }),
  );

  return ok({ partners: enriched });
});
