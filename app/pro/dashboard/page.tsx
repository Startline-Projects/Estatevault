"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const TIPS = [
  "Financial advisors who introduce estate planning in client review meetings see 3x higher conversion. Try leading with: 'Have you thought about what happens to your assets?'",
  "Trust packages convert better when you explain the probate process first. Michigan probate takes 9\u201318 months on average.",
  "Your clients with children under 18 are your highest-intent prospects for trust packages.",
  "The best time to introduce estate planning is right after a client reviews their investment portfolio \u2014 they're already thinking about their money.",
  "Clients who use the Family Vault feature are significantly less likely to churn. Encourage every client to set up their vault.",
];

export default function ProDashboardPage() {
  const [companyName, setCompanyName] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [certified, setCertified] = useState(false);
  const [stats, setStats] = useState({ clients: 0, docsThisMonth: 0, mtdEarnings: 0, referralFees: 0 });
  const [recentActivity, setRecentActivity] = useState<Array<{ action: string; created_at: string }>>([]);
  const [dismissed, setDismissed] = useState(false);
  const [businessUrl, setBusinessUrl] = useState("");

  useEffect(() => {
    setDismissed(!!localStorage.getItem("ev_welcome_dismissed"));

    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: partner } = await supabase.from("partners").select("id, company_name, business_url, certification_completed").eq("profile_id", user.id).single();
      if (!partner) return;
      setPartnerId(partner.id);
      setCompanyName(partner.company_name || "Partner");
      setBusinessUrl(partner.business_url || "");
      setCertified(partner.certification_completed || false);

      // Stats
      const { count: clientCount } = await supabase.from("clients").select("id", { count: "exact", head: true }).eq("partner_id", partner.id);
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const { data: monthOrders } = await supabase.from("orders").select("partner_cut, status").eq("partner_id", partner.id).gte("created_at", monthStart).in("status", ["paid", "delivered", "generating", "review"]);

      const docsThisMonth = monthOrders?.length || 0;
      const mtdEarnings = monthOrders?.reduce((sum, o) => sum + (o.partner_cut || 0), 0) || 0;

      const { data: refs } = await supabase.from("referrals").select("referral_fee").eq("partner_id", partner.id).eq("referral_fee_paid", true).gte("created_at", monthStart);
      const referralFees = refs?.reduce((sum, r) => sum + (r.referral_fee || 0), 0) || 0;

      setStats({ clients: clientCount || 0, docsThisMonth, mtdEarnings: mtdEarnings / 100, referralFees: referralFees / 100 });

      // Activity
      const { data: activity } = await supabase.from("audit_log").select("action, created_at").order("created_at", { ascending: false }).limit(10);
      setRecentActivity(activity || []);
    }
    load();
  }, []);

  const tipIndex = Math.floor(Date.now() / (24 * 60 * 60 * 1000)) % TIPS.length;

  function timeAgo(date: string) {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <div className="max-w-5xl">
      {/* Welcome banner */}
      {!dismissed && (
        <div className="rounded-xl bg-navy p-6 mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">Welcome to your live platform, {companyName}!</h1>
            {businessUrl && <p className="mt-1 text-sm text-blue-100/60">Your white-label URL is live at legacy.{businessUrl}</p>}
          </div>
          <button onClick={() => { setDismissed(true); localStorage.setItem("ev_welcome_dismissed", "1"); }} className="text-white/60 hover:text-white text-xl">×</button>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Active Clients", value: stats.clients },
          { label: "Documents This Month", value: stats.docsThisMonth },
          { label: "MTD Earnings", value: `$${stats.mtdEarnings.toLocaleString()}` },
          { label: "Referral Fees", value: `$${stats.referralFees.toLocaleString()}` },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-white border border-gray-200 p-5">
            <p className="text-xs text-charcoal/50 uppercase tracking-wider">{s.label}</p>
            <p className="mt-2 text-2xl font-bold text-navy">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Recent activity */}
      <div className="mt-6 rounded-xl bg-white border border-gray-200 p-6">
        <h2 className="text-base font-bold text-navy">Recent Activity</h2>
        {recentActivity.length === 0 ? (
          <div className="mt-6 text-center">
            <p className="text-sm text-charcoal/50">No activity yet. Create your first client session to get started.</p>
            {certified ? (
              <Link href="/pro/clients" className="mt-4 inline-flex items-center rounded-full bg-gold px-5 py-2 text-sm font-semibold text-white hover:bg-gold/90">+ New Client Session</Link>
            ) : (
              <button disabled className="mt-4 inline-flex items-center rounded-full bg-gray-200 px-5 py-2 text-sm font-semibold text-gray-400 cursor-not-allowed" title="Complete certification to unlock">🔒 New Client Session</button>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {recentActivity.map((a, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-400" />
                  <span className="text-charcoal/70">{a.action.replace(/\./g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</span>
                </div>
                <span className="text-xs text-charcoal/60">{timeAgo(a.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Monthly insight */}
      <div className="mt-6 rounded-xl bg-gray-50 border border-gray-200 p-6">
        <p className="text-xs font-medium uppercase tracking-wider text-gold">💡 Partner Insight</p>
        <p className="mt-2 text-sm text-charcoal/70 leading-relaxed">{TIPS[tipIndex]}</p>
      </div>

      {/* Floating new client button */}
      {certified ? (
        <Link href="/pro/clients" className="fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-semibold text-white shadow-lg hover:bg-gold/90 transition-colors">
          + New Client
        </Link>
      ) : (
        <button disabled className="fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full bg-gray-300 px-6 py-3 text-sm font-semibold text-gray-500 shadow-lg cursor-not-allowed" title="Complete certification to unlock">
          🔒 New Client
        </button>
      )}
    </div>
  );
}
