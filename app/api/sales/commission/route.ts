import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok } from "@/lib/api/response";
import { PARTNER_PLATFORM_FEE } from "@/lib/orders/pricing";
import * as profileRepo from "@/lib/repos/server/profileRepo";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";

const TIER_FEE_CENTS: Record<string, number> = {
  basic: PARTNER_PLATFORM_FEE.basic,
  standard: PARTNER_PLATFORM_FEE.standard,
  enterprise: PARTNER_PLATFORM_FEE.enterprise,
};

function effectiveFeeCents(p: { tier: string | null; platform_fee_amount: number | null; one_time_fee_paid: boolean | null }): number {
  if (p.one_time_fee_paid && p.platform_fee_amount) return p.platform_fee_amount;
  const tier = (p.tier || "standard").toLowerCase();
  return TIER_FEE_CENTS[tier] ?? TIER_FEE_CENTS.standard;
}

// B2: per-rep commission summary, aggregated server-side (was a direct
// client-side read of all profiles + all partners in app/sales/commission).
export const GET = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["sales_rep", "admin", "review_attorney"], req);
  if ("error" in auth) return auth.error;

  const { data: reps } = await profileRepo.findAllSalesReps(auth.admin);
  const { data: partners } = await partnerRepo.listAllForCommission(auth.admin);
  const allPartners = partners ?? [];

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const repSummaries = (reps ?? [])
    .map((rep) => {
      const repPartners = allPartners.filter((p) => p.created_by === rep.id);
      const mtdPartners = repPartners.filter((p) => p.created_at && new Date(p.created_at) >= monthStart);
      const rate = rep.commission_rate ?? 0.5;
      const mtdFees = mtdPartners.reduce((s, p) => s + effectiveFeeCents(p), 0) / 100;
      return {
        repId: rep.id,
        repName: rep.full_name || "Unknown",
        repEmail: rep.email || "",
        commissionRate: rate,
        mtdPlatformFees: mtdFees,
        mtdCommissionOwed: mtdFees * rate,
        totalPartners: repPartners.length,
        mtdPartners: mtdPartners.length,
      };
    })
    .sort((a, b) => b.mtdCommissionOwed - a.mtdCommissionOwed);

  return ok({
    repSummaries,
    totalMtdOwed: repSummaries.reduce((s, r) => s + r.mtdCommissionOwed, 0),
    totalMtdFees: repSummaries.reduce((s, r) => s + r.mtdPlatformFees, 0),
  });
});
