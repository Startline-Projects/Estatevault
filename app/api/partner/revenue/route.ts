import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";

function getNextFriday(): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : 7 - dayOfWeek + 5;
  const nextFriday = new Date(now);
  nextFriday.setDate(now.getDate() + (daysUntilFriday === 0 ? 7 : daysUntilFriday));
  nextFriday.setHours(0, 0, 0, 0);
  return nextFriday.toISOString();
}

export const GET = withRoute(async (_req: NextRequest) => {
  const auth = await requireAuth(["partner"]);
  if ("error" in auth) return auth.error;

  const { data: partnerRow } = await auth.admin
    .from("partners")
    .select("id")
    .eq("profile_id", auth.profile.id)
    .single();
  if (!partnerRow) return fail("Partner profile not found", 404);

  const partnerId = partnerRow.id;

  const { data: orders, error: ordersError } = await partnerRepo.getCompletedOrders(auth.admin, partnerId);
  if (ordersError) return fail("Failed to fetch orders", 500);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const mtdStart = new Date(currentYear, currentMonth, 1);
  const lastMonthStart = new Date(currentYear, currentMonth - 1, 1);
  const lastMonthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);
  const ytdStart = new Date(currentYear, 0, 1);

  let mtdEarnings = 0;
  let lastMonthEarnings = 0;
  let ytdEarnings = 0;
  let allTimeEarnings = 0;

  const earningsByType: Record<string, number> = {
    will: 0, trust: 0, amendment: 0, attorney_review: 0, vault_subscription: 0,
  };
  const monthlyTrendMap: Record<string, number> = {};

  for (const order of orders || []) {
    const amount = order.partner_cut || 0;
    const orderDate = new Date(order.created_at);
    const productType = order.product_type || "other";

    allTimeEarnings += amount;
    if (orderDate >= mtdStart) mtdEarnings += amount;
    if (orderDate >= lastMonthStart && orderDate <= lastMonthEnd) lastMonthEarnings += amount;
    if (orderDate >= ytdStart) ytdEarnings += amount;
    if (productType in earningsByType) earningsByType[productType] += amount;

    const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, "0")}`;
    monthlyTrendMap[monthKey] = (monthlyTrendMap[monthKey] || 0) + amount;
  }

  const { data: pendingOrders } = await partnerRepo.getPendingOrders(auth.admin, partnerId);
  let pendingBalance = 0;
  for (const order of pendingOrders || []) pendingBalance += order.partner_cut || 0;

  const monthlyTrend = Object.entries(monthlyTrendMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, amount]) => ({ month, amount }));

  const { data: recentPayouts } = await partnerRepo.getRecentPayouts(auth.admin, partnerId);

  return ok({
    mtd_earnings: mtdEarnings,
    last_month_earnings: lastMonthEarnings,
    ytd_earnings: ytdEarnings,
    all_time_earnings: allTimeEarnings,
    pending_balance: pendingBalance,
    next_payout_date: getNextFriday(),
    earnings_by_type: earningsByType,
    recent_payouts: (recentPayouts || []).map((p) => ({
      id: p.id,
      amount: p.partner_cut,
      product_type: p.product_type,
      date: p.created_at,
      transfer_id: p.transfer_id,
    })),
    monthly_trend: monthlyTrend,
  });
});
