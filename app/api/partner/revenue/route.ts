import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    }
  );
}

function getNextFriday(): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  // Days until next Friday (5 = Friday)
  const daysUntilFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : 7 - dayOfWeek + 5;
  const nextFriday = new Date(now);
  nextFriday.setDate(now.getDate() + (daysUntilFriday === 0 ? 7 : daysUntilFriday));
  nextFriday.setHours(0, 0, 0, 0);
  return nextFriday.toISOString();
}

export async function GET() {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    // Get the partner record for this user
    const { data: partner, error: partnerError } = await admin
      .from("partners")
      .select("id")
      .eq("profile_id", user.id)
      .single();

    if (partnerError || !partner) {
      return NextResponse.json(
        { error: "Partner profile not found" },
        { status: 404 }
      );
    }

    const partnerId = partner.id;

    // Get all completed orders for this partner
    const { data: orders, error: ordersError } = await admin
      .from("orders")
      .select("id, partner_cut, product_type, created_at, status")
      .eq("partner_id", partnerId)
      .eq("status", "completed");

    if (ordersError) {
      return NextResponse.json(
        { error: "Failed to fetch orders" },
        { status: 500 }
      );
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Calculate the first day of current month and last month
    const mtdStart = new Date(currentYear, currentMonth, 1);
    const lastMonthStart = new Date(currentYear, currentMonth - 1, 1);
    const lastMonthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);
    const ytdStart = new Date(currentYear, 0, 1);

    let mtdEarnings = 0;
    let lastMonthEarnings = 0;
    let ytdEarnings = 0;
    let allTimeEarnings = 0;
    let pendingBalance = 0;

    const earningsByType: Record<string, number> = {
      will: 0,
      trust: 0,
      amendment: 0,
      attorney_review: 0,
      vault_subscription: 0,
    };

    const monthlyTrendMap: Record<string, number> = {};

    for (const order of orders || []) {
      const amount = order.partner_cut || 0;
      const orderDate = new Date(order.created_at);
      const productType = order.product_type || "other";

      allTimeEarnings += amount;

      // MTD
      if (orderDate >= mtdStart) {
        mtdEarnings += amount;
      }

      // Last month
      if (orderDate >= lastMonthStart && orderDate <= lastMonthEnd) {
        lastMonthEarnings += amount;
      }

      // YTD
      if (orderDate >= ytdStart) {
        ytdEarnings += amount;
      }

      // By type
      if (productType in earningsByType) {
        earningsByType[productType] += amount;
      }

      // Monthly trend (key: YYYY-MM)
      const monthKey = `${orderDate.getFullYear()}-${String(
        orderDate.getMonth() + 1
      ).padStart(2, "0")}`;
      monthlyTrendMap[monthKey] = (monthlyTrendMap[monthKey] || 0) + amount;
    }

    // Get pending orders (paid but not yet transferred)
    const { data: pendingOrders } = await admin
      .from("orders")
      .select("partner_cut")
      .eq("partner_id", partnerId)
      .eq("status", "paid")
      .is("transfer_id", null);

    for (const order of pendingOrders || []) {
      pendingBalance += order.partner_cut || 0;
    }

    // Build monthly trend array sorted by month
    const monthlyTrend = Object.entries(monthlyTrendMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amount]) => ({ month, amount }));

    // Get recent payouts (transfers)
    const { data: recentPayouts } = await admin
      .from("orders")
      .select("id, partner_cut, product_type, created_at, transfer_id")
      .eq("partner_id", partnerId)
      .not("transfer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(10);

    return NextResponse.json({
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
  } catch (error) {
    console.error("Revenue API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch revenue data" },
      { status: 500 }
    );
  }
}
