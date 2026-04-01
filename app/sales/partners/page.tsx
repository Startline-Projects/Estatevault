"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type PartnerStatus = "onboarding" | "active" | "suspended" | "cancelled";
type PlanTier = "standard" | "enterprise";

interface Partner {
  id: string;
  company_name: string;
  owner_name: string;
  email: string;
  plan_tier: PlanTier;
  status: PartnerStatus;
  onboarding_step: number;
  certification_completed: boolean;
  created_at: string;
  updated_at: string;
  mtd_docs: number;
  mtd_revenue: number;
}

const STATUS_STYLES: Record<PartnerStatus, { label: string; cls: string }> = {
  onboarding: { label: "Onboarding", cls: "bg-blue-100 text-blue-700" },
  active: { label: "Active", cls: "bg-green-100 text-green-700" },
  suspended: { label: "Suspended", cls: "bg-red-100 text-red-700" },
  cancelled: { label: "Cancelled", cls: "bg-gray-100 text-gray-500" },
};

const TIER_STYLES: Record<PlanTier, { label: string; cls: string }> = {
  standard: { label: "Standard", cls: "bg-gray-100 text-gray-700" },
  enterprise: { label: "Enterprise", cls: "bg-[#C9A84C]/10 text-[#C9A84C]" },
};

export default function PartnersListPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from("partners")
        .select("id, company_name, tier, status, onboarding_step, onboarding_completed, created_at, updated_at, profiles!profile_id(full_name, email)")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });

      if (data) {
        // Fetch MTD stats for each partner
        const now = new Date();
        const mtdStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const enriched: Partner[] = await Promise.all(
          data.map(async (p) => {
            const { count: docCount } = await supabase
              .from("orders")
              .select("*", { count: "exact", head: true })
              .eq("partner_id", p.id)
              .gte("created_at", mtdStart);
            const { data: revData } = await supabase
              .from("orders")
              .select("partner_cut")
              .eq("partner_id", p.id)
              .gte("created_at", mtdStart);
            const mtdRev = (revData || []).reduce((sum, o) => sum + (o.partner_cut || 0), 0);
            const profile = (p as unknown as Record<string, unknown>).profiles as { full_name: string; email: string } | null;
            return {
              id: p.id,
              company_name: p.company_name,
              owner_name: profile?.full_name || "",
              email: profile?.email || "",
              plan_tier: (p.tier || "standard") as PlanTier,
              status: (p.status || "onboarding") as PartnerStatus,
              onboarding_step: p.onboarding_step || 1,
              certification_completed: p.onboarding_completed || false,
              created_at: p.created_at,
              updated_at: p.updated_at,
              mtd_docs: docCount || 0,
              mtd_revenue: mtdRev,
            };
          })
        );
        setPartners(enriched);
      }
      setLoading(false);
    }
    load();
  }, []);

  function isStuck(partner: Partner): boolean {
    if (partner.status !== "onboarding") return false;
    const updated = new Date(partner.updated_at || partner.created_at);
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    return updated < threeDaysAgo;
  }

  const filtered = partners.filter((p) => {
    if (search) {
      const q = search.toLowerCase();
      if (
        !p.company_name.toLowerCase().includes(q) &&
        !p.email.toLowerCase().includes(q) &&
        !(p.owner_name || "").toLowerCase().includes(q)
      ) return false;
    }
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (tierFilter !== "all" && p.plan_tier !== tierFilter) return false;
    return true;
  });

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#2D2D2D]">
            My Partners{" "}
            <span className="text-base font-normal text-gray-400">({partners.length})</span>
          </h1>
        </div>
        <Link
          href="/sales/new-partner"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#C9A84C] text-white text-sm font-semibold hover:bg-[#b89740] transition"
        >
          <span className="text-base leading-none">+</span> New Partner
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40 focus:border-[#C9A84C]"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40"
          >
            <option value="all">All Statuses</option>
            <option value="onboarding">Onboarding</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40"
          >
            <option value="all">All Tiers</option>
            <option value="standard">Standard</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <div className="w-8 h-8 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-400">Loading partners...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-[#2D2D2D] mb-1">No partners found</h3>
          <p className="text-sm text-gray-400 mb-4">
            {search || statusFilter !== "all" || tierFilter !== "all"
              ? "Try adjusting your search or filters."
              : "Create your first partner to get started."}
          </p>
          {!search && statusFilter === "all" && tierFilter === "all" && (
            <Link
              href="/sales/new-partner"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#C9A84C] text-white text-sm font-semibold hover:bg-[#b89740] transition"
            >
              <span className="text-base leading-none">+</span> New Partner
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Company</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Tier</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Onboarding</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Certified</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">MTD Docs</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">MTD Revenue</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const stuck = isStuck(p);
                  const sStatus = STATUS_STYLES[p.status] || STATUS_STYLES.onboarding;
                  const sTier = TIER_STYLES[p.plan_tier] || TIER_STYLES.standard;
                  const onboardingDone = p.onboarding_step >= 7 && p.status !== "onboarding";

                  return (
                    <tr
                      key={p.id}
                      className={`border-b border-gray-50 hover:bg-gray-50/50 transition ${stuck ? "bg-amber-50/60" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#2D2D2D]">{p.company_name}</p>
                        <p className="text-xs text-gray-400">{p.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${sTier.cls}`}>
                          {sTier.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${sStatus.cls}`}>
                          {sStatus.label}
                        </span>
                        {stuck && (
                          <span className="ml-1.5 text-[10px] text-amber-600 font-medium">Stuck 3d+</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {onboardingDone ? (
                          <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            Complete
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">Step {p.onboarding_step} of 7</span>
                            <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#C9A84C] rounded-full transition-all"
                                style={{ width: `${(p.onboarding_step / 7) * 100}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {p.certification_completed ? (
                          <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            Yes
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">No</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-[#2D2D2D]">{p.mtd_docs}</td>
                      <td className="px-4 py-3 text-right font-medium text-[#2D2D2D]">
                        ${p.mtd_revenue.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/sales/partners/${p.id}`}
                          className="text-[#C9A84C] hover:text-[#b89740] text-xs font-semibold transition"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
