export const dynamic = "force-dynamic";

import { headers } from "next/headers";
import Link from "next/link";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@/lib/supabase/server";
import AffiliateLinkCard from "@/components/AffiliateLinkCard";
import AffiliateOnboardingResume from "@/components/AffiliateOnboardingResume";

// Service-role client: the `orders` table has no RLS policy for affiliates,
// so reads must bypass RLS. Scoped explicitly to the signed-in affiliate's id.
function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

function fmtDollars(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

const WINDOW_DAYS = 30;

// Build an ordered list of the last `days` calendar days (oldest → newest),
// each keyed by YYYY-MM-DD, summing values bucketed onto that day.
function dailyBuckets(
  rows: { created_at: string; value?: number }[],
  days: number
): { key: string; label: string; total: number }[] {
  const buckets: { key: string; label: string; total: number }[] = [];
  const index: Record<string, number> = {};
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    index[key] = buckets.length;
    buckets.push({
      key,
      label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      total: 0,
    });
  }
  for (const r of rows) {
    const key = new Date(r.created_at).toISOString().slice(0, 10);
    const i = index[key];
    if (i !== undefined) buckets[i].total += r.value ?? 1;
  }
  return buckets;
}

// Lightweight dependency-free bar chart. Server-rendered CSS bars.
function BarChart({
  data,
  color,
  format,
}: {
  data: { key: string; label: string; total: number }[];
  color: string;
  format?: (n: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.total));
  const fmt = format ?? ((n: number) => String(n));
  return (
    <div className="mt-4 flex items-end gap-[3px] h-40">
      {data.map((d) => (
        <div key={d.key} className="flex-1 flex flex-col items-center justify-end h-full group relative">
          <div
            className="w-full rounded-t-sm transition-all"
            style={{
              height: `${(d.total / max) * 100}%`,
              minHeight: d.total > 0 ? "2px" : "0px",
              background: color,
            }}
          />
          <div className="absolute -top-7 hidden group-hover:block whitespace-nowrap rounded bg-navy px-2 py-1 text-[10px] font-semibold text-white shadow">
            {fmt(d.total)} · {d.label}
          </div>
        </div>
      ))}
    </div>
  );
}

type TabKey = "overview" | "performance" | "payouts";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "performance", label: "Performance" },
  { key: "payouts", label: "Payouts" },
];

export default async function AffiliateDashboardPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const tab: TabKey = (["overview", "performance", "payouts"].includes(
    searchParams.tab || ""
  )
    ? searchParams.tab
    : "overview") as TabKey;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Layout already gated, user is non-null and type=affiliate

  const { data: affiliate } = await supabase
    .from("affiliates")
    .select("id, code, status, stripe_onboarding_complete, total_clicks, total_conversions, total_earned_cents")
    .eq("profile_id", user!.id)
    .single();

  if (!affiliate) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm text-center">
          <h2 className="text-xl font-bold text-navy">No affiliate record found</h2>
          <p className="mt-2 text-sm text-charcoal/60">
            Please complete your affiliate signup.
          </p>
          <Link
            href="/affiliate-signup"
            className="mt-6 inline-block bg-gold hover:bg-gold/90 text-navy font-bold px-6 py-3 rounded-lg transition-colors"
          >
            Continue Signup
          </Link>
        </div>
      </div>
    );
  }

  // Determine origin for full referral link
  const host = headers().get("host") || "www.estatevault.us";
  const proto = host.includes("localhost") ? "http" : "https";
  const referralLink = `${proto}://${host}/a/${affiliate.code}`;

  const admin = createAdminClient();
  const since = new Date();
  since.setDate(since.getDate() - WINDOW_DAYS);
  const sinceISO = since.toISOString();

  // Recent converted orders attributed to this affiliate
  const { data: recentOrders } = await admin
    .from("orders")
    .select("id, product_type, amount_total, affiliate_cut, status, created_at")
    .eq("affiliate_id", affiliate.id)
    .order("created_at", { ascending: false })
    .limit(10);

  // All payouts (history + paid-out total for the pending estimate)
  const { data: payouts } = await admin
    .from("affiliate_payouts")
    .select("id, amount_cents, status, paid_at, created_at, stripe_transfer_id")
    .eq("affiliate_id", affiliate.id)
    .order("created_at", { ascending: false });

  // Attributed (non-pending) orders — drives all-time stats + earnings trend.
  const { data: attributedOrders } = await admin
    .from("orders")
    .select("affiliate_cut, created_at")
    .eq("affiliate_id", affiliate.id)
    .neq("status", "pending");

  // Clicks in the trend window
  const { data: clicks } = await admin
    .from("affiliate_clicks")
    .select("created_at")
    .eq("affiliate_id", affiliate.id)
    .gte("created_at", sinceISO);

  const conversions = attributedOrders?.length ?? 0;
  const earnedCents = (attributedOrders ?? []).reduce(
    (sum, o) => sum + (o.affiliate_cut || 0),
    0
  );
  // A payout counts as money out the door once it's been sent — mirror the
  // admin payout route's covering statuses so the two views never disagree.
  const PAID_STATUSES = ["pending", "processing", "sent", "paid"];
  const paidCents = (payouts ?? [])
    .filter((p) => PAID_STATUSES.includes(p.status))
    .reduce((sum, p) => sum + (p.amount_cents || 0), 0);
  const pendingCents = Math.max(0, earnedCents - paidCents);

  const conversionRate =
    affiliate.total_clicks > 0
      ? (conversions / affiliate.total_clicks) * 100
      : 0;

  // Trend buckets (last 30 days)
  const clickSeries = dailyBuckets(
    (clicks ?? []).map((c) => ({ created_at: c.created_at })),
    WINDOW_DAYS
  );
  const recentAttributed = (attributedOrders ?? []).filter(
    (o) => new Date(o.created_at) >= since
  );
  const conversionSeries = dailyBuckets(
    recentAttributed.map((o) => ({ created_at: o.created_at })),
    WINDOW_DAYS
  );
  const earningsSeries = dailyBuckets(
    recentAttributed.map((o) => ({ created_at: o.created_at, value: o.affiliate_cut || 0 })),
    WINDOW_DAYS
  );

  const onboardingPending =
    affiliate.status !== "active" || !affiliate.stripe_onboarding_complete;

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 space-y-8">
      {onboardingPending && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-amber-900">
              Finish Stripe onboarding to receive payouts
            </p>
            <p className="mt-1 text-xs text-amber-800/80">
              We can&apos;t send commissions until your bank info and tax details are on file.
            </p>
          </div>
          <AffiliateOnboardingResume />
        </div>
      )}

      {/* Referral link — always visible */}
      <AffiliateLinkCard link={referralLink} code={affiliate.code} />

      {/* Tab nav */}
      <nav className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Link
              key={t.key}
              href={t.key === "overview" ? "/affiliate" : `/affiliate?tab=${t.key}`}
              className={`px-4 py-2.5 text-sm font-semibold -mb-px border-b-2 transition-colors ${
                active
                  ? "border-gold text-navy"
                  : "border-transparent text-charcoal/50 hover:text-charcoal/80"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      {/* ---------------- OVERVIEW ---------------- */}
      {tab === "overview" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <p className="text-xs font-semibold text-charcoal/60 uppercase tracking-wider">Clicks</p>
              <p className="mt-2 text-3xl font-bold text-navy">{affiliate.total_clicks}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <p className="text-xs font-semibold text-charcoal/60 uppercase tracking-wider">Conversions</p>
              <p className="mt-2 text-3xl font-bold text-navy">{conversions}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <p className="text-xs font-semibold text-charcoal/60 uppercase tracking-wider">Total Earned</p>
              <p className="mt-2 text-3xl font-bold text-gold">{fmtDollars(earnedCents)}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-navy">Recent Conversions</h2>
            {recentOrders && recentOrders.length > 0 ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left">
                      <th className="py-2 px-3 font-semibold text-charcoal/60">Product</th>
                      <th className="py-2 px-3 font-semibold text-charcoal/60">Status</th>
                      <th className="py-2 px-3 font-semibold text-charcoal/60 text-right">Order Total</th>
                      <th className="py-2 px-3 font-semibold text-charcoal/60 text-right">Your Cut</th>
                      <th className="py-2 px-3 font-semibold text-charcoal/60">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((o) => (
                      <tr key={o.id} className="border-b border-gray-100">
                        <td className="py-3 px-3 capitalize text-charcoal">{o.product_type}</td>
                        <td className="py-3 px-3 text-charcoal/70">{o.status}</td>
                        <td className="py-3 px-3 text-right text-charcoal">{fmtDollars(o.amount_total)}</td>
                        <td className="py-3 px-3 text-right font-bold text-gold">{fmtDollars(o.affiliate_cut || 0)}</td>
                        <td className="py-3 px-3 text-charcoal/60 text-xs">
                          {new Date(o.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-4 text-sm text-charcoal/60">
                No conversions yet. Share your link to start earning.
              </p>
            )}
          </div>
        </>
      )}

      {/* ---------------- PERFORMANCE ---------------- */}
      {tab === "performance" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <p className="text-xs font-semibold text-charcoal/60 uppercase tracking-wider">Conversion Rate</p>
              <p className="mt-2 text-3xl font-bold text-navy">{conversionRate.toFixed(1)}%</p>
              <p className="mt-1 text-xs text-charcoal/50">
                {conversions} of {affiliate.total_clicks} clicks
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <p className="text-xs font-semibold text-charcoal/60 uppercase tracking-wider">
                Clicks · {WINDOW_DAYS}d
              </p>
              <p className="mt-2 text-3xl font-bold text-navy">
                {clickSeries.reduce((s, d) => s + d.total, 0)}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <p className="text-xs font-semibold text-charcoal/60 uppercase tracking-wider">
                Earned · {WINDOW_DAYS}d
              </p>
              <p className="mt-2 text-3xl font-bold text-gold">
                {fmtDollars(earningsSeries.reduce((s, d) => s + d.total, 0))}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-navy">Clicks · last {WINDOW_DAYS} days</h2>
            <BarChart data={clickSeries} color="#1C3557" />
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-navy">Conversions · last {WINDOW_DAYS} days</h2>
            <BarChart data={conversionSeries} color="#C9A84C" />
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-navy">Earnings · last {WINDOW_DAYS} days</h2>
            <BarChart data={earningsSeries} color="#C9A84C" format={fmtDollars} />
          </div>
        </>
      )}

      {/* ---------------- PAYOUTS ---------------- */}
      {tab === "payouts" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <p className="text-xs font-semibold text-charcoal/60 uppercase tracking-wider">Pending Balance</p>
              <p className="mt-2 text-3xl font-bold text-gold">{fmtDollars(pendingCents)}</p>
              <p className="mt-1 text-xs text-charcoal/50">Earned, not yet paid out</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <p className="text-xs font-semibold text-charcoal/60 uppercase tracking-wider">Paid Out</p>
              <p className="mt-2 text-3xl font-bold text-navy">{fmtDollars(paidCents)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <p className="text-xs font-semibold text-charcoal/60 uppercase tracking-wider">Payout Account</p>
              <p className={`mt-2 text-lg font-bold ${onboardingPending ? "text-amber-600" : "text-emerald-600"}`}>
                {onboardingPending ? "Action needed" : "Connected"}
              </p>
              {onboardingPending && (
                <div className="mt-3">
                  <AffiliateOnboardingResume />
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-navy">Payout History</h2>
            {payouts && payouts.length > 0 ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left">
                      <th className="py-2 px-3 font-semibold text-charcoal/60">Amount</th>
                      <th className="py-2 px-3 font-semibold text-charcoal/60">Status</th>
                      <th className="py-2 px-3 font-semibold text-charcoal/60">Stripe Transfer</th>
                      <th className="py-2 px-3 font-semibold text-charcoal/60">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.map((p) => (
                      <tr key={p.id} className="border-b border-gray-100">
                        <td className="py-3 px-3 font-bold text-gold">{fmtDollars(p.amount_cents)}</td>
                        <td className="py-3 px-3 capitalize text-charcoal/70">{p.status}</td>
                        <td className="py-3 px-3 text-charcoal/60 font-mono text-xs">
                          {p.stripe_transfer_id || "—"}
                        </td>
                        <td className="py-3 px-3 text-charcoal/60 text-xs">
                          {new Date(p.paid_at || p.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-4 text-sm text-charcoal/60">No payouts yet.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
