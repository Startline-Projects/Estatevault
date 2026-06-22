import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok } from "@/lib/api/response";
import { PARTNER_PLATFORM_FEE } from "@/lib/orders/pricing";
import { DEFAULT_COMMISSION_RATE } from "@/lib/sales/constants";
import * as profileRepo from "@/lib/repos/server/profileRepo";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";
import * as commissionPayoutRepo from "@/lib/repos/server/commissionPayoutRepo";

function periodKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

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

  const [{ data: reps }, { data: attorneys }, { data: partners }] = await Promise.all([
    profileRepo.findAllSalesReps(auth.admin),
    profileRepo.findAllReviewAttorneys(auth.admin),
    partnerRepo.listAllForCommission(auth.admin),
  ]);
  const allPartners = partners ?? [];

  const now = new Date();
  const period = periodKey(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Recipients already paid out for the current period — drives the "Paid" flag
  // (and lets the UI disable the Mark Paid button).
  const { data: paidRows } = await commissionPayoutRepo.listForPeriod(auth.admin, period);
  const paidSet = new Set((paidRows ?? []).map((r) => r.recipient_id));

  // Both sales reps and review attorneys earn commission on partners they
  // recruit, so both are payout recipients.
  const recipients = [
    ...(reps ?? []).map((r) => ({ ...r, role: "sales_rep" as const })),
    ...(attorneys ?? []).map((a) => ({ ...a, role: "review_attorney" as const })),
  ];

  const repSummaries = recipients
    .map((rep) => {
      const repPartners = allPartners.filter((p) => p.created_by === rep.id);
      const mtdPartners = repPartners.filter((p) => p.created_at && new Date(p.created_at) >= monthStart);
      const rate = rep.commission_rate ?? DEFAULT_COMMISSION_RATE;
      // Only partners who actually paid their platform fee generate commission.
      const mtdFees = mtdPartners
        .filter((p) => p.one_time_fee_paid)
        .reduce((s, p) => s + effectiveFeeCents(p), 0) / 100;
      return {
        repId: rep.id,
        repName: rep.full_name || "Unknown",
        repEmail: rep.email || "",
        role: rep.role,
        commissionRate: rate,
        mtdPlatformFees: mtdFees,
        mtdCommissionOwed: mtdFees * rate,
        totalPartners: repPartners.length,
        mtdPartners: mtdPartners.length,
        currentPeriodPaid: paidSet.has(rep.id),
      };
    })
    .sort((a, b) => b.mtdCommissionOwed - a.mtdCommissionOwed);

  return ok({
    period,
    repSummaries,
    totalMtdOwed: repSummaries.reduce((s, r) => s + r.mtdCommissionOwed, 0),
    totalMtdFees: repSummaries.reduce((s, r) => s + r.mtdPlatformFees, 0),
  });
});
