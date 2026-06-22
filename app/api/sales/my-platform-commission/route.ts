import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok } from "@/lib/api/response";
import { PARTNER_PLATFORM_FEE } from "@/lib/orders/pricing";
import { DEFAULT_COMMISSION_RATE } from "@/lib/sales/constants";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";
import * as profileRepo from "@/lib/repos/server/profileRepo";
import * as commissionPayoutRepo from "@/lib/repos/server/commissionPayoutRepo";

type PartnerRow = {
  id: string;
  company_name: string | null;
  tier: string | null;
  platform_fee_amount: number | null;
  one_time_fee_paid: boolean | null;
  created_at: string | null;
};

const TIER_FEE_CENTS: Record<string, number> = {
  basic: PARTNER_PLATFORM_FEE.basic,
  standard: PARTNER_PLATFORM_FEE.standard,
  enterprise: PARTNER_PLATFORM_FEE.enterprise,
};

function effectiveFeeCents(p: PartnerRow): number {
  if (p.one_time_fee_paid && p.platform_fee_amount) return p.platform_fee_amount;
  const tier = (p.tier || "standard").toLowerCase();
  return TIER_FEE_CENTS[tier] ?? TIER_FEE_CENTS.standard;
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// Period key used by commission_payouts: 'YYYY-MM'.
function periodKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// B2: the signed-in rep's platform-fee commission (was a direct client-side read
// of profiles.commission_rate + their created partners in app/sales/commission).
export const GET = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["sales_rep", "admin", "review_attorney"], req);
  if ("error" in auth) return auth.error;

  const { data: prof } = await profileRepo.getCommissionRateById(auth.admin, auth.user.id);
  const rate = prof?.commission_rate ?? DEFAULT_COMMISSION_RATE;

  const { data: partnersRaw } = await partnerRepo.listForRepCommission(auth.admin, auth.user.id);
  const partners = (partnersRaw ?? []) as PartnerRow[];

  // Periods this recipient has actually been paid out for — the source of truth
  // for a real "Paid" status (vs merely "Owed" once earned).
  const { data: payouts } = await commissionPayoutRepo.listForRecipient(auth.admin, auth.user.id);
  const paidPeriods = new Set((payouts ?? []).map((p) => p.period));

  const now = new Date();
  const currentPeriod = periodKey(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const mtdPartners = partners.filter((p) => p.created_at && new Date(p.created_at) >= monthStart);
  // Commission is earned only once a partner has actually paid their one-time
  // platform fee — unpaid signups stay visible as pipeline but contribute $0.
  // (Previously every signup counted, inflating the headline with unpaid rows.)
  const mtdFees = mtdPartners
    .filter((p) => p.one_time_fee_paid)
    .reduce((s, p) => s + effectiveFeeCents(p), 0) / 100;

  const breakdown = mtdPartners
    .map((p) => {
      const earned = !!p.one_time_fee_paid; // partner paid their fee => commission earned
      const fee = effectiveFeeCents(p) / 100;
      // "Paid" only when this month's commission has actually been paid out to
      // the recipient (a commission_payouts row exists). Earned-but-not-paid is
      // "Owed"; partner hasn't paid their fee yet is "Pending".
      const status = !earned ? "Pending" : paidPeriods.has(currentPeriod) ? "Paid" : "Owed";
      return {
        partnerName: p.company_name || "Unknown",
        platformFee: fee,
        commission: earned ? fee * rate : 0,
        paidAt: p.created_at ? new Date(p.created_at).toLocaleDateString() : "",
        status,
      };
    })
    .sort((a, b) => b.platformFee - a.platformFee);

  const history: Array<{ month: string; platformFees: number; commission: number; status: string }> = [];
  for (let i = 0; i < 6; i++) {
    const mDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const monthPartners = partners.filter((p) => {
      if (!p.created_at) return false;
      const d = new Date(p.created_at);
      return d >= mDate && d < mEnd;
    });
    const fees = monthPartners
      .filter((p) => p.one_time_fee_paid)
      .reduce((s, p) => s + effectiveFeeCents(p), 0) / 100;
    const commission = fees * rate;
    // "Paid" is now real: a commission_payouts row for this period means the
    // recipient was actually paid out. Otherwise earned commission is "Owed"
    // (current month still accruing => "Pending"); an empty month is "—".
    const status =
      commission <= 0
        ? "—"
        : paidPeriods.has(periodKey(mDate))
          ? "Paid"
          : i === 0
            ? "Pending"
            : "Owed";
    history.push({
      month: monthLabel(mDate),
      platformFees: fees,
      commission,
      status,
    });
  }

  return ok({ commissionRate: rate, mtdCommission: mtdFees * rate, breakdown, history });
});
