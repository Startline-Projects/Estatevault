export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";
import AffiliateAdminTabs, {
  type RosterRow,
  type OrderRow,
  type PayoutRow,
} from "@/components/sales/AffiliateAdminTabs";

// Service-role client: the affiliate program tables are admin-readable via RLS,
// but `orders` has no admin-affiliate policy, so reads must bypass RLS. The
// page itself is gated to user_type === 'admin' before any data is touched.
function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

function fmtDollars(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

// Payouts in any non-terminal/successful state count against the balance owed,
// so we never double-pay an affiliate whose payout is still in flight.
const COVERING_PAYOUT_STATUSES = ["pending", "processing", "sent"];

function AccessDenied() {
  return (
    <div className="max-w-md mx-auto py-24 text-center">
      <h2 className="text-lg font-semibold text-charcoal">Admin access required</h2>
      <p className="mt-2 text-sm text-gray-400">
        The affiliate program dashboard is only available to platform admins.
      </p>
    </div>
  );
}

export default async function AffiliateAdminPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <AccessDenied />;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("user_type")
    .eq("id", user.id)
    .single();
  if (profile?.user_type !== "admin") return <AccessDenied />;

  // ── Fetch everything ───────────────────────────────────────────────
  const [{ data: affiliates }, { data: orders }, { data: payouts }] = await Promise.all([
    admin
      .from("affiliates")
      .select(
        "id, code, full_name, email, status, stripe_account_id, stripe_onboarding_complete, total_clicks, created_at"
      )
      .order("created_at", { ascending: false }),
    admin
      .from("orders")
      .select("id, product_type, amount_total, affiliate_cut, status, created_at, affiliate_id")
      .not("affiliate_id", "is", null)
      .order("created_at", { ascending: false }),
    admin
      .from("affiliate_payouts")
      .select("id, affiliate_id, amount_cents, status, stripe_transfer_id, paid_at, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const affiliateList = affiliates ?? [];
  const orderList = orders ?? [];
  const payoutList = payouts ?? [];

  // name/code lookup for the order + payout ledgers
  const nameById = new Map<string, { name: string; code: string }>();
  affiliateList.forEach((a) =>
    nameById.set(a.id, { name: a.full_name, code: a.code })
  );

  // ── Per-affiliate rollups ──────────────────────────────────────────
  const roster: RosterRow[] = affiliateList.map((a) => {
    const theirOrders = orderList.filter((o) => o.affiliate_id === a.id);
    const converted = theirOrders.filter((o) => o.status !== "pending");
    const earnedCents = converted.reduce((s, o) => s + (o.affiliate_cut || 0), 0);

    const theirPayouts = payoutList.filter((p) => p.affiliate_id === a.id);
    const paidCents = theirPayouts
      .filter((p) => p.status === "sent")
      .reduce((s, p) => s + (p.amount_cents || 0), 0);
    const coveredCents = theirPayouts
      .filter((p) => COVERING_PAYOUT_STATUSES.includes(p.status))
      .reduce((s, p) => s + (p.amount_cents || 0), 0);

    const clicks = a.total_clicks || 0;
    const conversions = converted.length;

    return {
      id: a.id,
      code: a.code,
      full_name: a.full_name,
      email: a.email,
      status: a.status,
      created_at: a.created_at,
      stripeReady: !!a.stripe_account_id && !!a.stripe_onboarding_complete,
      clicks,
      conversions,
      conversionRate: clicks > 0 ? conversions / clicks : 0,
      earnedCents,
      paidCents,
      unpaidCents: Math.max(0, earnedCents - coveredCents),
    };
  });

  const ordersEnriched: OrderRow[] = orderList.map((o) => ({
    id: o.id,
    product_type: o.product_type,
    amount_total: o.amount_total,
    affiliate_cut: o.affiliate_cut || 0,
    status: o.status,
    created_at: o.created_at,
    affiliate_id: o.affiliate_id,
    affiliate_name: nameById.get(o.affiliate_id)?.name || "Unknown",
  }));

  const payoutsEnriched: PayoutRow[] = payoutList.map((p) => ({
    id: p.id,
    affiliate_id: p.affiliate_id,
    affiliate_name: nameById.get(p.affiliate_id)?.name || "Unknown",
    amount_cents: p.amount_cents,
    status: p.status,
    stripe_transfer_id: p.stripe_transfer_id,
    paid_at: p.paid_at,
    created_at: p.created_at,
  }));

  // ── Program-wide totals ────────────────────────────────────────────
  const activeCount = roster.filter((r) => r.status === "active").length;
  const totalClicks = roster.reduce((s, r) => s + r.clicks, 0);
  const totalConversions = roster.reduce((s, r) => s + r.conversions, 0);
  const totalEarned = roster.reduce((s, r) => s + r.earnedCents, 0);
  const totalPaid = roster.reduce((s, r) => s + r.paidCents, 0);
  const totalUnpaid = roster.reduce((s, r) => s + r.unpaidCents, 0);

  const stats: { label: string; value: string | number }[] = [
    { label: "Affiliates", value: roster.length },
    { label: "Active", value: activeCount },
    { label: "Total Clicks", value: totalClicks.toLocaleString() },
    { label: "Conversions", value: totalConversions.toLocaleString() },
    { label: "Total Earned", value: fmtDollars(totalEarned) },
    { label: "Paid Out", value: fmtDollars(totalPaid) },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Headline */}
      <div className="bg-navy rounded-xl p-6 text-white">
        <p className="text-sm font-medium text-white/60 uppercase tracking-wide">
          Commissions Owed to Affiliates
        </p>
        <p className="text-4xl font-bold mt-2">{fmtDollars(totalUnpaid)}</p>
        <p className="text-sm text-white/50 mt-1">
          {activeCount} active affiliate{activeCount !== 1 ? "s" : ""} ·{" "}
          {fmtDollars(totalPaid)} paid out all-time
        </p>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-xl border border-gray-200 p-5"
          >
            <p className="text-xs text-gray-400 uppercase tracking-wider">
              {s.label}
            </p>
            <p className="mt-2 text-2xl font-bold text-navy">{s.value}</p>
          </div>
        ))}
      </div>

      <AffiliateAdminTabs
        roster={roster}
        orders={ordersEnriched}
        payouts={payoutsEnriched}
      />
    </div>
  );
}
