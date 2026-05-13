"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { usePortalBase } from "@/lib/portal-base";
import TeamManagement from "@/components/sales/TeamManagement";
import TestControls from "@/components/sales/TestControls";

interface LeadRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company_name: string;
  professional_type: string;
  client_count: number;
  referral_source: string;
  status: string;
  created_at: string;
}

interface PartnerRow {
  id: string;
  company_name: string;
  tier: string;
  status: string;
  created_at: string;
  updated_at: string;
  onboarding_completed: boolean;
  onboarding_step: number;
  platform_fee_amount: number;
  one_time_fee_paid: boolean;
}

interface OrderRow {
  ev_cut: number;
  partner_cut: number;
  partner_id: string;
  status: string;
}

interface PendingAttorney {
  id: string;
  company_name: string;
  bar_number: string;
  tier: string;
  review_fee: number | null;
  created_at: string;
  profile_name: string;
  profile_email: string;
}

interface StuckPartner {
  id: string;
  company_name: string;
  onboarding_step: number;
  daysSinceUpdate: number;
}

interface RecentPartnerDisplay {
  id: string;
  company_name: string;
  tier: string;
  status: string;
  mtdDocs: number;
  mtdRevenue: number;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay} days ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

export default function SalesDashboardPage() {
  const base = usePortalBase();
  const [repName, setRepName] = useState("");
  const [userType, setUserType] = useState("");
  const [loading, setLoading] = useState(true);
  const [activePartners, setActivePartners] = useState(0);
  const [onboardingPartners, setOnboardingPartners] = useState(0);
  const [mtdEvRevenue, setMtdEvRevenue] = useState(0);
  const [mtdPlatformFees, setMtdPlatformFees] = useState(0);
  const [stuckPartners, setStuckPartners] = useState<StuckPartner[]>([]);
  const [recentPartners, setRecentPartners] = useState<RecentPartnerDisplay[]>([]);
  const [nudgingId, setNudgingId] = useState<string | null>(null);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [markingLeadId, setMarkingLeadId] = useState<string | null>(null);
  const [pendingAttorneys, setPendingAttorneys] = useState<PendingAttorney[]>([]);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [barVerificationMessage, setBarVerificationMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Rep name and type from profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, user_type")
        .eq("id", user.id)
        .single();

      const name = profileData?.full_name ||
        user.user_metadata?.full_name ||
        user.email?.split("@")[0] ||
        "Rep";
      setRepName(name);
      if (profileData?.user_type) setUserType(profileData.user_type);

      // Fetch partners, admin sees all, reps see only their own
      const isAdmin = profileData?.user_type === "admin" || profileData?.user_type === "review_attorney";
      let partnersQuery = supabase
        .from("partners")
        .select("id, company_name, tier, status, created_at, updated_at, onboarding_completed, onboarding_step, platform_fee_amount, one_time_fee_paid");
      if (!isAdmin) partnersQuery = partnersQuery.eq("created_by", user.id);
      const { data: partners } = await partnersQuery;

      const typedPartners = (partners || []) as PartnerRow[];

      // Stat cards
      const active = typedPartners.filter((p) => p.status === "active").length;
      const onboarding = typedPartners.filter((p) => !p.onboarding_completed).length;
      setActivePartners(active);
      setOnboardingPartners(onboarding);

      // MTD revenue from orders for this rep's partners
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const partnerIds = typedPartners.map((p) => p.id);

      const { data: orders } = partnerIds.length > 0
        ? await supabase
            .from("orders")
            .select("ev_cut, partner_cut, partner_id, status")
            .in("partner_id", partnerIds)
            .in("status", ["paid", "delivered", "generating", "review"])
            .gte("created_at", monthStart)
        : { data: [] };

      const typedOrders = (orders || []) as OrderRow[];

      // MTD EstateVault revenue = sum of ev_cut (EV's share from document sales)
      const evRevenue = typedOrders.reduce((sum, o) => sum + (o.ev_cut || 0), 0) / 100;
      setMtdEvRevenue(evRevenue);

      // MTD Platform Fees = sum of platform_fee_amount from partners who paid their fee this month
      const platformFees = typedPartners
        .filter((p) => p.one_time_fee_paid && new Date(p.created_at) >= new Date(monthStart))
        .reduce((sum, p) => sum + (p.platform_fee_amount || 0), 0) / 100;
      setMtdPlatformFees(platformFees);

      // Stuck partners: on same onboarding step 3+ days
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const stuck = typedPartners
        .filter(
          (p) =>
            !p.onboarding_completed &&
            p.updated_at &&
            new Date(p.updated_at) < threeDaysAgo
        )
        .map((p) => ({
          id: p.id,
          company_name: p.company_name,
          onboarding_step: p.onboarding_step,
          daysSinceUpdate: Math.floor(
            (Date.now() - new Date(p.updated_at).getTime()) / (1000 * 60 * 60 * 24)
          ),
        }));
      setStuckPartners(stuck);

      // Recent 5 partners with MTD stats
      const sorted = [...typedPartners].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const recent5 = sorted.slice(0, 5);

      const recentDisplay: RecentPartnerDisplay[] = recent5.map((p) => {
        const partnerOrders = typedOrders.filter((o) => o.partner_id === p.id);
        // partner_cut = what the partner earned from document sales this month
        const partnerEarnings = partnerOrders.reduce((sum, o) => sum + (o.partner_cut || 0), 0) / 100;
        return {
          id: p.id,
          company_name: p.company_name,
          tier: p.tier,
          status: p.status,
          mtdDocs: partnerOrders.length,
          mtdRevenue: partnerEarnings,
        };
      });
      setRecentPartners(recentDisplay);

      // Fetch new leads
      const { data: leadsData } = await supabase
        .from("professional_leads")
        .select("*")
        .in("status", ["new", "contacted"])
        .order("created_at", { ascending: false })
        .limit(10);

      if (leadsData) {
        setLeads(leadsData as LeadRow[]);
      }

      // Fetch pending attorney verifications
      const { data: pendingData } = await supabase
        .from("partners")
        .select("id, company_name, bar_number, tier, custom_review_fee, created_at, profile_id")
        .eq("status", "pending_verification")
        .eq("professional_type", "attorney")
        .order("created_at", { ascending: false });

      if (pendingData && pendingData.length > 0) {
        const profileIds = pendingData
          .map((p: { profile_id: string | null }) => p.profile_id)
          .filter(Boolean) as string[];

        let profileMap: Record<string, { full_name: string; email: string }> = {};
        if (profileIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name, email")
            .in("id", profileIds);

          if (profiles) {
            for (const prof of profiles) {
              profileMap[prof.id] = {
                full_name: prof.full_name || "Unknown",
                email: prof.email || "",
              };
            }
          }
        }

        const mapped: PendingAttorney[] = pendingData.map(
          (p: {
            id: string;
            company_name: string;
            bar_number: string;
            tier: string;
            custom_review_fee: number | null;
            created_at: string;
            profile_id: string | null;
          }) => ({
            id: p.id,
            company_name: p.company_name,
            bar_number: p.bar_number || "N/A",
            tier: p.tier,
            review_fee: p.custom_review_fee,
            created_at: p.created_at,
            profile_name: p.profile_id ? profileMap[p.profile_id]?.full_name || "Unknown" : "Unknown",
            profile_email: p.profile_id ? profileMap[p.profile_id]?.email || "" : "",
          })
        );
        setPendingAttorneys(mapped);
      }

      setLoading(false);
    }
    load();
  }, []);

  async function handleNudge(partnerId: string) {
    setNudgingId(partnerId);
    // In production this would send an email via an API route
    await new Promise((r) => setTimeout(r, 800));
    setStuckPartners((prev) => prev.filter((p) => p.id !== partnerId));
    setNudgingId(null);
  }

  async function handleMarkContacted(leadId: string) {
    setMarkingLeadId(leadId);
    const supabase = createClient();
    const { error } = await supabase
      .from("professional_leads")
      .update({ status: "contacted" })
      .eq("id", leadId);

    if (!error) {
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, status: "contacted" } : l))
      );
    }
    setMarkingLeadId(null);
  }

  async function handleActivateAttorney(partnerId: string, email: string, name: string) {
    setActivatingId(partnerId);
    setBarVerificationMessage(null);
    const supabase = createClient();

    const { error } = await supabase
      .from("partners")
      .update({ status: "active" })
      .eq("id", partnerId);

    if (error) {
      setBarVerificationMessage("Failed to activate account. Please try again.");
      setActivatingId(null);
      return;
    }

    // Try to send activation email
    try {
      await fetch("/api/email/partner-activated", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });
    } catch {
      // Email failure is non-blocking
      console.error("Activation email failed to send, but account was activated.");
    }

    setPendingAttorneys((prev) => prev.filter((a) => a.id !== partnerId));
    setBarVerificationMessage(`${name} has been activated successfully.`);
    setActivatingId(null);
  }

  async function handleRejectAttorney(partnerId: string, name: string) {
    const confirmed = window.confirm(
      `Are you sure you want to reject ${name}? This action cannot be easily undone.`
    );
    if (!confirmed) return;

    setRejectingId(partnerId);
    setBarVerificationMessage(null);
    const supabase = createClient();

    const { error } = await supabase
      .from("partners")
      .update({ status: "rejected" })
      .eq("id", partnerId);

    if (error) {
      setBarVerificationMessage("Failed to reject account. Please try again.");
      setRejectingId(null);
      return;
    }

    setPendingAttorneys((prev) => prev.filter((a) => a.id !== partnerId));
    setBarVerificationMessage(`${name} has been rejected.`);
    setRejectingId(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-navy border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const statCards = [
    { label: "Active Partners", value: activePartners.toString() },
    { label: "Partners in Onboarding", value: onboardingPartners.toString() },
    { label: "MTD EstateVault Revenue", value: formatCurrency(mtdEvRevenue) },
    { label: "MTD Platform Fees Collected", value: formatCurrency(mtdPlatformFees) },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-charcoal">
          {getGreeting()}, {repName}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Here is your sales overview for {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm"
          >
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{card.label}</p>
            <p className="text-2xl font-bold text-navy mt-2">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Pending Bar Verification */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
          <h2 className="text-sm font-semibold text-charcoal">Pending Bar Verification</h2>
          {pendingAttorneys.length > 0 && (
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white min-w-[20px]">
              {pendingAttorneys.length}
            </span>
          )}
        </div>

        {barVerificationMessage && (
          <div className="px-5 pt-3">
            <div className="text-sm px-4 py-2 rounded-lg bg-green-50 text-green-700 border border-green-200">
              {barVerificationMessage}
            </div>
          </div>
        )}

        {pendingAttorneys.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">
            No attorneys waiting for bar verification.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Attorney
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Firm
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Bar Number
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Tier
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Review Fee
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Signed Up
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {pendingAttorneys.map((attorney) => (
                  <tr
                    key={attorney.id}
                    className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <p className="font-medium text-charcoal">{attorney.profile_name}</p>
                      {attorney.profile_email && (
                        <p className="text-xs text-gray-400">{attorney.profile_email}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-600 whitespace-nowrap">
                      {attorney.company_name}
                    </td>
                    <td className="px-5 py-3 font-mono text-navy whitespace-nowrap">
                      {attorney.bar_number}
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-navy/10 text-navy capitalize">
                        {attorney.tier}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-gray-600">
                      {attorney.review_fee != null ? formatCurrency(attorney.review_fee / 100) : "--"}
                    </td>
                    <td className="px-5 py-3 text-gray-500 whitespace-nowrap">
                      {relativeTime(attorney.created_at)}
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href="https://www.michbar.org/memberdirectory"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                        >
                          Verify at michbar.org &rarr;
                        </a>
                        <button
                          onClick={() =>
                            handleActivateAttorney(
                              attorney.id,
                              attorney.profile_email,
                              attorney.profile_name
                            )
                          }
                          disabled={activatingId === attorney.id}
                          className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          {activatingId === attorney.id ? "Activating..." : "Activate Account"}
                        </button>
                        <button
                          onClick={() =>
                            handleRejectAttorney(attorney.id, attorney.profile_name)
                          }
                          disabled={rejectingId === attorney.id}
                          className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                          {rejectingId === attorney.id ? "Rejecting..." : "Reject"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Alerts Panel */}
      {stuckPartners.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-amber-800 mb-3">
            Onboarding Alerts ({stuckPartners.length})
          </h2>
          <div className="space-y-3">
            {stuckPartners.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between bg-white rounded-lg px-4 py-3 border border-amber-100"
              >
                <div>
                  <p className="text-sm font-medium text-charcoal">{p.company_name}</p>
                  <p className="text-xs text-gray-500">
                    Stuck on Step {p.onboarding_step} for {p.daysSinceUpdate} days
                  </p>
                </div>
                <button
                  onClick={() => handleNudge(p.id)}
                  disabled={nudgingId === p.id}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors disabled:opacity-50"
                >
                  {nudgingId === p.id ? "Sending..." : "Send Nudge"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New Leads */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
          <h2 className="text-sm font-semibold text-charcoal">New Leads</h2>
          {leads.filter((l) => l.status === "new").length > 0 && (
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-gold text-white min-w-[20px]">
              {leads.filter((l) => l.status === "new").length}
            </span>
          )}
        </div>
        {leads.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">
            No new leads. Share{" "}
            <span className="font-medium text-gold">estatevault.us/professionals</span>{" "}
            to generate interest.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Name
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Company
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Type
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Clients
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Source
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Submitted
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-5 py-3 font-medium text-charcoal whitespace-nowrap">
                      {lead.first_name} {lead.last_name}
                    </td>
                    <td className="px-5 py-3 text-gray-600 whitespace-nowrap">
                      {lead.company_name}
                    </td>
                    <td className="px-5 py-3 text-gray-600 capitalize whitespace-nowrap">
                      {lead.professional_type}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-600">
                      {lead.client_count ?? ", "}
                    </td>
                    <td className="px-5 py-3 text-gray-600 capitalize whitespace-nowrap">
                      {lead.referral_source || ", "}
                    </td>
                    <td className="px-5 py-3 text-gray-500 whitespace-nowrap">
                      {relativeTime(lead.created_at)}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          lead.status === "new"
                            ? "bg-gold/15 text-gold"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {lead.status === "new" ? "New" : "Contacted"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/sales/new-partner?name=${encodeURIComponent(
                            lead.company_name
                          )}&email=${encodeURIComponent(
                            lead.email
                          )}&phone=${encodeURIComponent(
                            lead.phone || ""
                          )}&type=${encodeURIComponent(
                            lead.professional_type
                          )}`}
                          className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-gold text-white hover:bg-gold-600 transition-colors"
                        >
                          Create Account {"\u2192"}
                        </Link>
                        {lead.status === "new" && (
                          <button
                            onClick={() => handleMarkContacted(lead.id)}
                            disabled={markingLeadId === lead.id}
                            className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50"
                          >
                            {markingLeadId === lead.id ? "Updating..." : "Mark Contacted"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Partners Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-charcoal">Recent Partners</h2>
          <Link
            href={`${base}/partners`}
            className="text-xs font-medium text-gold hover:underline"
          >
            View All
          </Link>
        </div>
        {recentPartners.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">
            No partners yet. Create your first partner to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Name
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Tier
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    MTD Docs
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    MTD Partner Earnings
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentPartners.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-charcoal">{p.company_name}</td>
                    <td className="px-5 py-3">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-navy/10 text-navy capitalize">
                        {p.tier}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium capitalize ${
                          p.status === "active"
                            ? "bg-green-100 text-green-700"
                            : p.status === "onboarding"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-gray-600">{p.mtdDocs}</td>
                    <td className="px-5 py-3 text-right font-medium text-charcoal">
                      {formatCurrency(p.mtdRevenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Admin Only Sections */}
      {userType === "admin" && (
        <>
          <TeamManagement />
          <TestControls />
        </>
      )}
    </div>
  );
}
