import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok } from "@/lib/api/response";
import { PARTNER_PLATFORM_FEE } from "@/lib/orders/pricing";
import { DEFAULT_COMMISSION_RATE } from "@/lib/sales/constants";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";
import * as profileRepo from "@/lib/repos/server/profileRepo";

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

// B2: the signed-in rep's platform-fee commission (was a direct client-side read
// of profiles.commission_rate + their created partners in app/sales/commission).
export const GET = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["sales_rep", "admin", "review_attorney"], req);
  if ("error" in auth) return auth.error;

  const { data: prof } = await profileRepo.getCommissionRateById(auth.admin, auth.user.id);
  const rate = prof?.commission_rate ?? DEFAULT_COMMISSION_RATE;

  const { data: partnersRaw } = await partnerRepo.listForRepCommission(auth.admin, auth.user.id);
  const partners = (partnersRaw ?? []) as PartnerRow[];

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const mtdPartners = partners.filter((p) => p.created_at && new Date(p.created_at) >= monthStart);
  const mtdFees = mtdPartners.reduce((s, p) => s + effectiveFeeCents(p), 0) / 100;

  const breakdown = mtdPartners
    .map((p) => {
      const fee = effectiveFeeCents(p) / 100;
      return {
        partnerName: p.company_name || "Unknown",
        platformFee: fee,
        commission: fee * rate,
        paidAt: p.created_at ? new Date(p.created_at).toLocaleDateString() : "",
        status: p.one_time_fee_paid ? "Paid" : "Pending",
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
    const fees = monthPartners.reduce((s, p) => s + effectiveFeeCents(p), 0) / 100;
    history.push({
      month: monthLabel(mDate),
      platformFees: fees,
      commission: fees * rate,
      status: i === 0 ? "Pending" : "Paid",
    });
  }

  return ok({ commissionRate: rate, mtdCommission: mtdFees * rate, breakdown, history });
});
