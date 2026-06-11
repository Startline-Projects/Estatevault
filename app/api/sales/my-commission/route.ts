import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok } from "@/lib/api/response";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";
import * as orderRepo from "@/lib/repos/server/orderRepo";
import { DEFAULT_DEFAULT_COMMISSION_RATE } from "@/lib/sales/constants";

function getMonthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// B2: the signed-in rep's own commission breakdown + 6-month history (was a
// direct client-side read of their partners + orders in pro/sales/commission).
export const GET = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["sales_rep", "admin", "review_attorney"], req);
  if ("error" in auth) return auth.error;

  const { data: partners } = await partnerRepo.listManagedForDashboard(auth.admin, auth.user.id);
  const myPartners = partners ?? [];
  const partnerMap = new Map(myPartners.map((p) => [p.id, p.company_name]));
  const partnerIds = myPartners.map((p) => p.id);

  if (partnerIds.length === 0) {
    return ok({ breakdown: [], mtdCommission: 0, history: [] });
  }

  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();
  const { data: ordersRaw } = await orderRepo.listSinceDatedByPartnerIds(auth.admin, partnerIds, sixMonthsAgo);
  const orders = ordersRaw ?? [];

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const mtdOrders = orders.filter((o) => o.created_at && new Date(o.created_at) >= monthStart);

  const revenueByPartner = new Map<string, number>();
  for (const o of mtdOrders) {
    if (!o.partner_id) continue;
    revenueByPartner.set(o.partner_id, (revenueByPartner.get(o.partner_id) || 0) + (o.amount_total || 0));
  }

  const breakdown: Array<{ partnerName: string; mtdRevenue: number; commission: number }> = [];
  let totalMtdRevenue = 0;
  revenueByPartner.forEach((cents, partnerId) => {
    const dollars = cents / 100;
    totalMtdRevenue += dollars;
    breakdown.push({ partnerName: partnerMap.get(partnerId) || "Unknown", mtdRevenue: dollars, commission: dollars * DEFAULT_COMMISSION_RATE });
  });
  for (const p of myPartners) {
    if (!revenueByPartner.has(p.id)) breakdown.push({ partnerName: p.company_name || "Unknown", mtdRevenue: 0, commission: 0 });
  }
  breakdown.sort((a, b) => b.mtdRevenue - a.mtdRevenue);

  const history: Array<{ month: string; partnerRevenue: number; commission: number; status: string }> = [];
  for (let i = 0; i < 6; i++) {
    const mDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const monthOrders = orders.filter((o) => {
      if (!o.created_at) return false;
      const d = new Date(o.created_at);
      return d >= mDate && d < mEnd;
    });
    const partnerRevenue = monthOrders.reduce((s, o) => s + (o.amount_total || 0), 0) / 100;
    history.push({
      month: getMonthLabel(mDate),
      partnerRevenue,
      commission: partnerRevenue * DEFAULT_COMMISSION_RATE,
      status: i === 0 ? "Pending" : "Paid",
    });
  }

  return ok({ breakdown, mtdCommission: totalMtdRevenue * DEFAULT_COMMISSION_RATE, history });
});
