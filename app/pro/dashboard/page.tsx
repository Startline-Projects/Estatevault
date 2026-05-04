"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const TIPS = [
  "Financial advisors who introduce estate planning in client review meetings see 3x higher conversion. Try leading with: 'Have you thought about what happens to your assets?'",
  "Trust packages convert better when you explain the probate process first. Michigan probate takes 9 to 18 months on average.",
  "Your clients with children under 18 are your highest-intent prospects for trust packages.",
  "The best time to introduce estate planning is right after a client reviews their investment portfolio, they're already thinking about their money.",
  "Clients who use the Family Vault feature are significantly less likely to churn. Encourage every client to set up their vault.",
];

const VAULT_TIPS = [
  "Share your vault URL in your email signature — clients who sign up from a trusted advisor convert at 3x the rate of cold traffic.",
  "Introduce the vault as a 'digital safety deposit box' — most clients immediately understand the value.",
  "Clients with young children are your highest-intent vault prospects. They worry about what happens if both parents are gone.",
  "The farewell video feature is a powerful conversation starter. Ask clients: 'Have you ever thought about leaving a message for your family?'",
  "Trustees are the stickiest feature. Once a client names a trustee, they almost never cancel.",
];

export default function ProDashboardPage() {
  const [companyName, setCompanyName] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [certified, setCertified] = useState(false);
  const [tier, setTier] = useState<"standard" | "enterprise" | "basic" | "">("");
  const [vaultSubdomain, setVaultSubdomain] = useState("");
  const [businessUrl, setBusinessUrl] = useState("");
  const [stats, setStats] = useState({ clients: 0, docsThisMonth: 0, mtdEarnings: 0, referralFees: 0 });
  const [vaultStats, setVaultStats] = useState({ vaultClients: 0, activeSubscriptions: 0 });
  const [recentActivity, setRecentActivity] = useState<Array<{ action: string; created_at: string }>>([]);
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setDismissed(!!localStorage.getItem("ev_welcome_dismissed"));

    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: partner } = await supabase
        .from("partners")
        .select("id, company_name, business_url, certification_completed, tier, vault_subdomain")
        .eq("profile_id", user.id)
        .single();
      if (!partner) { setLoading(false); return; }

      setPartnerId(partner.id);
      setCompanyName(partner.company_name || "Partner");
      setBusinessUrl(partner.business_url || "");
      setCertified(partner.certification_completed || false);
      setTier(partner.tier || "standard");
      setVaultSubdomain(partner.vault_subdomain || "");

      const isBasic = partner.tier === "basic";

      if (isBasic) {
        // Vault-only stats
        const { count: vaultClientCount } = await supabase
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("partner_id", partner.id);

        const { count: activeSubs } = await supabase
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("partner_id", partner.id)
          .eq("vault_subscription_status", "active");

        setVaultStats({
          vaultClients: vaultClientCount || 0,
          activeSubscriptions: activeSubs || 0,
        });
      } else {
        // Standard/Enterprise stats
        const { count: clientCount } = await supabase
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("partner_id", partner.id);

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        const { data: monthOrders } = await supabase
          .from("orders")
          .select("partner_cut, status")
          .eq("partner_id", partner.id)
          .gte("created_at", monthStart)
          .in("status", ["paid", "delivered", "generating", "review"]);

        const docsThisMonth = monthOrders?.length || 0;
        const mtdEarnings = monthOrders?.reduce((sum, o) => sum + (o.partner_cut || 0), 0) || 0;

        const { data: refs } = await supabase
          .from("referrals")
          .select("referral_fee")
          .eq("partner_id", partner.id)
          .eq("referral_fee_paid", true)
          .gte("created_at", monthStart);
        const referralFees = refs?.reduce((sum, r) => sum + (r.referral_fee || 0), 0) || 0;

        setStats({ clients: clientCount || 0, docsThisMonth, mtdEarnings: mtdEarnings / 100, referralFees: referralFees / 100 });
      }

      const { data: activity } = await supabase
        .from("audit_log")
        .select("action, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      setRecentActivity(activity || []);
      setLoading(false);
    }
    load();
  }, []);

  const tipIndex = Math.floor(Date.now() / (24 * 60 * 60 * 1000)) % TIPS.length;
  const isBasic = tier === "basic";
  const vaultUrl = vaultSubdomain ? `https://${vaultSubdomain}.estatevault.us` : null;

  function timeAgo(date: string) {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  function handleCopy() {
    if (!vaultUrl) return;
    navigator.clipboard.writeText(vaultUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="max-w-5xl animate-pulse">
        <div className="rounded-xl bg-gray-100 h-24 mb-6" />
        <div className="rounded-xl bg-gray-100 h-20 mb-6" />
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl bg-gray-100 h-24" />
          <div className="rounded-xl bg-gray-100 h-24" />
        </div>
        <div className="mt-6 rounded-xl bg-gray-100 h-48" />
        <div className="mt-6 rounded-xl bg-gray-100 h-24" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      {/* Welcome banner */}
      {!dismissed && (
        <div className="rounded-xl bg-navy p-6 mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">Welcome to your live platform, {companyName}!</h1>
            {isBasic && vaultUrl && (
              <p className="mt-1 text-sm text-blue-100/60">Your vault is live at <span className="text-white/80">{vaultUrl}</span></p>
            )}
            {!isBasic && businessUrl && (
              <p className="mt-1 text-sm text-blue-100/60">Your white-label URL is live at legacy.{businessUrl}</p>
            )}
          </div>
          <button onClick={() => { setDismissed(true); localStorage.setItem("ev_welcome_dismissed", "1"); }} className="text-white/60 hover:text-white text-xl">×</button>
        </div>
      )}

      {/* Vault URL card — basic only */}
      {isBasic && vaultUrl && (
        <div className="rounded-xl bg-white border border-gray-200 p-5 mb-6 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Your Vault URL</p>
            <p className="text-sm font-mono text-navy font-medium truncate">{vaultUrl}</p>
            <p className="text-xs text-gray-400 mt-0.5">Share with clients to sign up for your vault</p>
          </div>
          <button
            onClick={handleCopy}
            className="shrink-0 px-4 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
          >
            {copied ? "Copied!" : "Copy Link"}
          </button>
        </div>
      )}

      {/* Stat cards */}
      {isBasic ? (
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "Vault Clients", value: vaultStats.vaultClients },
            { label: "Active Subscriptions", value: vaultStats.activeSubscriptions },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-white border border-gray-200 p-5">
              <p className="text-xs text-charcoal/50 uppercase tracking-wider">{s.label}</p>
              <p className="mt-2 text-2xl font-bold text-navy">{s.value}</p>
            </div>
          ))}
        </div>
      ) : (
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
      )}

      {/* Recent activity */}
      <div className="mt-6 rounded-xl bg-white border border-gray-200 p-6">
        <h2 className="text-base font-bold text-navy">Recent Activity</h2>
        {recentActivity.length === 0 ? (
          <div className="mt-6 text-center">
            <p className="text-sm text-charcoal/50">
              {isBasic
                ? "No activity yet. Share your vault URL to get your first client."
                : "No activity yet. Create your first client session to get started."}
            </p>
            {!isBasic && (
              certified ? (
                <Link href="/pro/clients" className="mt-4 inline-flex items-center rounded-full bg-gold px-5 py-2 text-sm font-semibold text-white hover:bg-gold/90">+ New Client Session</Link>
              ) : (
                <button disabled className="mt-4 inline-flex items-center rounded-full bg-gray-200 px-5 py-2 text-sm font-semibold text-gray-400 cursor-not-allowed" title="Complete certification to unlock">🔒 New Client Session</button>
              )
            )}
            {isBasic && vaultUrl && (
              <button onClick={handleCopy} className="mt-4 inline-flex items-center rounded-full bg-gold px-5 py-2 text-sm font-semibold text-white hover:bg-gold/90">
                {copied ? "Copied!" : "Copy Vault Link"}
              </button>
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

      {/* Insight tip */}
      <div className="mt-6 rounded-xl bg-gray-50 border border-gray-200 p-6">
        <p className="text-xs font-medium uppercase tracking-wider text-gold">💡 {isBasic ? "Vault Tip" : "Partner Insight"}</p>
        <p className="mt-2 text-sm text-charcoal/70 leading-relaxed">
          {isBasic ? VAULT_TIPS[tipIndex] : TIPS[tipIndex]}
        </p>
      </div>

      {/* Floating new client button — hidden for basic */}
      {!isBasic && (
        certified ? (
          <Link href="/pro/clients" className="fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-semibold text-white shadow-lg hover:bg-gold/90 transition-colors">
            + New Client
          </Link>
        ) : (
          <button disabled className="fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full bg-gray-300 px-6 py-3 text-sm font-semibold text-gray-500 shadow-lg cursor-not-allowed" title="Complete certification to unlock">
            🔒 New Client
          </button>
        )
      )}
    </div>
  );
}
