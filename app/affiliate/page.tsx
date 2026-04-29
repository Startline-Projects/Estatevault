import { headers } from "next/headers";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AffiliateLinkCard from "@/components/AffiliateLinkCard";
import AffiliateOnboardingResume from "@/components/AffiliateOnboardingResume";

function fmtDollars(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export default async function AffiliateDashboardPage() {
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

  // Recent converted orders attributed to this affiliate
  const { data: recentOrders } = await supabase
    .from("orders")
    .select("id, product_type, amount_total, affiliate_cut, status, created_at")
    .eq("affiliate_id", affiliate.id)
    .order("created_at", { ascending: false })
    .limit(10);

  // Recent payouts
  const { data: recentPayouts } = await supabase
    .from("affiliate_payouts")
    .select("id, amount_cents, status, paid_at, created_at, stripe_transfer_id")
    .eq("affiliate_id", affiliate.id)
    .order("created_at", { ascending: false })
    .limit(10);

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

      {/* Referral link */}
      <AffiliateLinkCard link={referralLink} code={affiliate.code} />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-xs font-semibold text-charcoal/60 uppercase tracking-wider">Clicks</p>
          <p className="mt-2 text-3xl font-bold text-navy">{affiliate.total_clicks}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-xs font-semibold text-charcoal/60 uppercase tracking-wider">Conversions</p>
          <p className="mt-2 text-3xl font-bold text-navy">{affiliate.total_conversions}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-xs font-semibold text-charcoal/60 uppercase tracking-wider">Total Earned</p>
          <p className="mt-2 text-3xl font-bold text-gold">{fmtDollars(affiliate.total_earned_cents)}</p>
        </div>
      </div>

      {/* Orders */}
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

      {/* Payouts */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-navy">Recent Payouts</h2>
        {recentPayouts && recentPayouts.length > 0 ? (
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
                {recentPayouts.map((p) => (
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
    </div>
  );
}
