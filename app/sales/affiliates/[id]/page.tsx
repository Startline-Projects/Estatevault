export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";
import AffiliateStatusToggle from "@/components/sales/AffiliateStatusToggle";
import AffiliatePayoutButton from "@/components/sales/AffiliatePayoutButton";

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

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const COVERING_PAYOUT_STATUSES = ["pending", "processing", "sent"];

const AFFILIATE_STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  pending_onboarding: "bg-amber-100 text-amber-700",
  suspended: "bg-red-100 text-red-700",
};

const PAYOUT_STATUS_STYLES: Record<string, string> = {
  sent: "bg-green-100 text-green-700",
  pending: "bg-amber-100 text-amber-700",
  processing: "bg-blue-100 text-blue-700",
  failed: "bg-red-100 text-red-700",
  reversed: "bg-gray-100 text-gray-500",
};

const TH =
  "text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide";
const THR = TH + " text-right";

function Denied({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-md mx-auto py-24 text-center">
      <h2 className="text-lg font-semibold text-charcoal">{children}</h2>
      <Link
        href="/sales/affiliates"
        className="text-gold text-sm mt-2 inline-block"
      >
        Back to affiliates
      </Link>
    </div>
  );
}

export default async function AffiliateDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <Denied>Admin access required</Denied>;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("user_type")
    .eq("id", user.id)
    .single();
  if (profile?.user_type !== "admin")
    return <Denied>Admin access required</Denied>;

  const affiliateId = params.id;
  const { data: affiliate } = await admin
    .from("affiliates")
    .select(
      "id, code, full_name, email, status, stripe_account_id, stripe_onboarding_complete, total_clicks, created_at"
    )
    .eq("id", affiliateId)
    .single();
  if (!affiliate) return <Denied>Affiliate not found</Denied>;

  const [{ data: orders }, { data: payouts }, { data: clicks }] =
    await Promise.all([
      admin
        .from("orders")
        .select("id, product_type, amount_total, affiliate_cut, status, created_at")
        .eq("affiliate_id", affiliateId)
        .order("created_at", { ascending: false }),
      admin
        .from("affiliate_payouts")
        .select("id, amount_cents, status, stripe_transfer_id, paid_at, created_at")
        .eq("affiliate_id", affiliateId)
        .order("created_at", { ascending: false }),
      admin
        .from("affiliate_clicks")
        .select("id, landing_path, referrer, converted, created_at")
        .eq("affiliate_id", affiliateId)
        .order("created_at", { ascending: false })
        .limit(25),
    ]);

  const orderList = orders ?? [];
  const payoutList = payouts ?? [];
  const clickList = clicks ?? [];

  // ── Earnings rollup ──────────────────────────────────────────────
  const converted = orderList.filter((o) => o.status !== "pending");
  const earnedCents = converted.reduce(
    (s, o) => s + (o.affiliate_cut || 0),
    0
  );
  const paidCents = payoutList
    .filter((p) => p.status === "sent")
    .reduce((s, p) => s + (p.amount_cents || 0), 0);
  const coveredCents = payoutList
    .filter((p) => COVERING_PAYOUT_STATUSES.includes(p.status))
    .reduce((s, p) => s + (p.amount_cents || 0), 0);
  const unpaidCents = Math.max(0, earnedCents - coveredCents);

  const clicksTotal = affiliate.total_clicks || 0;
  const conversions = converted.length;
  const conversionRate =
    clicksTotal > 0 ? (conversions / clicksTotal) * 100 : 0;
  const stripeReady =
    !!affiliate.stripe_account_id && !!affiliate.stripe_onboarding_complete;

  const sStatus =
    AFFILIATE_STATUS_STYLES[affiliate.status] || "bg-gray-100 text-gray-500";

  return (
    <div className="max-w-5xl mx-auto">
      {/* Back button */}
      <Link
        href="/sales/affiliates"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-navy transition mb-4"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back to Affiliates
      </Link>

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <Link
          href="/sales/affiliates"
          className="hover:text-gold transition"
        >
          Affiliates
        </Link>
        <span>/</span>
        <span className="text-charcoal font-medium">
          {affiliate.full_name}
        </span>
      </nav>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-charcoal">
                {affiliate.full_name}
              </h1>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${sStatus}`}
              >
                {affiliate.status.replace(/_/g, " ")}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-500">
              <span>{affiliate.email}</span>
              <span>
                Code:{" "}
                <span className="font-mono text-navy">{affiliate.code}</span>
              </span>
              <span>Joined {fmtDate(affiliate.created_at)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 shrink-0">
            <AffiliatePayoutButton
              affiliateId={affiliate.id}
              unpaidCents={unpaidCents}
              stripeReady={stripeReady}
            />
            <AffiliateStatusToggle
              affiliateId={affiliate.id}
              status={affiliate.status}
            />
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Earnings breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
          <h3 className="text-sm font-semibold text-navy uppercase tracking-wider mb-2">
            Earnings
          </h3>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Total Earned</span>
            <span className="text-sm font-medium text-charcoal">
              {fmtDollars(earnedCents)}
            </span>
          </div>
          <div className="h-px bg-gray-100" />
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Paid Out</span>
            <span className="text-sm font-medium text-charcoal">
              {fmtDollars(paidCents)}
            </span>
          </div>
          <div className="h-px bg-gray-100" />
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Unpaid Balance</span>
            <span className="text-base font-bold text-gold">
              {fmtDollars(unpaidCents)}
            </span>
          </div>
        </div>

        {/* Performance */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
          <h3 className="text-sm font-semibold text-navy uppercase tracking-wider mb-2">
            Performance
          </h3>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Clicks</span>
            <span className="text-sm font-medium text-charcoal">
              {clicksTotal.toLocaleString()}
            </span>
          </div>
          <div className="h-px bg-gray-100" />
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Conversions</span>
            <span className="text-sm font-medium text-charcoal">
              {conversions.toLocaleString()}
            </span>
          </div>
          <div className="h-px bg-gray-100" />
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Conversion Rate</span>
            <span className="text-sm font-medium text-charcoal">
              {conversionRate.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Stripe / payout readiness */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
          <h3 className="text-sm font-semibold text-navy uppercase tracking-wider mb-2">
            Payout Readiness
          </h3>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Stripe Onboarding</span>
            <span
              className={`text-sm font-medium ${
                affiliate.stripe_onboarding_complete
                  ? "text-green-600"
                  : "text-amber-600"
              }`}
            >
              {affiliate.stripe_onboarding_complete ? "Complete" : "Pending"}
            </span>
          </div>
          <div className="h-px bg-gray-100" />
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Can Receive Payouts</span>
            <span
              className={`text-sm font-medium ${
                stripeReady ? "text-green-600" : "text-gray-400"
              }`}
            >
              {stripeReady ? "Yes" : "No"}
            </span>
          </div>
          <div className="h-px bg-gray-100" />
          <div className="flex justify-between items-start gap-3">
            <span className="text-sm text-gray-500 shrink-0">
              Stripe Account
            </span>
            <span className="text-xs font-mono text-gray-400 text-right break-all">
              {affiliate.stripe_account_id || "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Attributed orders */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-charcoal">
            Attributed Orders
          </h2>
        </div>
        {orderList.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">
            No orders attributed to this affiliate yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className={TH}>Date</th>
                  <th className={TH}>Product</th>
                  <th className={TH}>Status</th>
                  <th className={THR}>Order Total</th>
                  <th className={THR}>Affiliate Cut</th>
                </tr>
              </thead>
              <tbody>
                {orderList.map((o) => (
                  <tr
                    key={o.id}
                    className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-5 py-3 text-gray-500 text-xs">
                      {fmtDate(o.created_at)}
                    </td>
                    <td className="px-5 py-3 capitalize text-charcoal">
                      {o.product_type}
                    </td>
                    <td className="px-5 py-3 capitalize text-gray-500">
                      {o.status}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-600">
                      {fmtDollars(o.amount_total)}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-gold">
                      {fmtDollars(o.affiliate_cut || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payouts */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-charcoal">Payouts</h2>
        </div>
        {payoutList.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">
            No payouts sent to this affiliate yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className={TH}>Date</th>
                  <th className={THR}>Amount</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>Stripe Transfer</th>
                </tr>
              </thead>
              <tbody>
                {payoutList.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-5 py-3 text-gray-500 text-xs">
                      {fmtDate(p.paid_at || p.created_at)}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-gold">
                      {fmtDollars(p.amount_cents)}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                          PAYOUT_STATUS_STYLES[p.status] ||
                          "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-gray-400">
                      {p.stripe_transfer_id || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent clicks */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-charcoal">
            Recent Clicks
          </h2>
        </div>
        {clickList.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">
            No referral clicks recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className={TH}>Date</th>
                  <th className={TH}>Landing Path</th>
                  <th className={TH}>Referrer</th>
                  <th className={TH}>Converted</th>
                </tr>
              </thead>
              <tbody>
                {clickList.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-5 py-3 text-gray-500 text-xs">
                      {fmtDate(c.created_at)}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-charcoal">
                      {c.landing_path || "—"}
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-400 break-all">
                      {c.referrer || "Direct"}
                    </td>
                    <td className="px-5 py-3">
                      {c.converted ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          Yes
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
