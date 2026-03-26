"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface PartnerRow {
  id: string;
  company_name: string;
  tier: string;
  status: string;
  created_at: string;
  onboarding_completed: boolean;
  current_onboarding_step: number;
  onboarding_step_updated_at: string;
}

interface OrderRow {
  amount_total: number;
  partner_id: string;
}

interface StuckPartner {
  id: string;
  company_name: string;
  current_onboarding_step: number;
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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

export default function SalesDashboardPage() {
  const [repName, setRepName] = useState("");
  const [loading, setLoading] = useState(true);
  const [activePartners, setActivePartners] = useState(0);
  const [onboardingPartners, setOnboardingPartners] = useState(0);
  const [mtdRevenue, setMtdRevenue] = useState(0);
  const [mtdCommission, setMtdCommission] = useState(0);
  const [stuckPartners, setStuckPartners] = useState<StuckPartner[]>([]);
  const [recentPartners, setRecentPartners] = useState<RecentPartnerDisplay[]>([]);
  const [nudgingId, setNudgingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Rep name from profile metadata
      const name =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "Rep";
      setRepName(name);

      // Fetch all partners created by this rep
      const { data: partners } = await supabase
        .from("partners")
        .select(
          "id, company_name, tier, status, created_at, onboarding_completed, current_onboarding_step, onboarding_step_updated_at"
        )
        .eq("created_by", user.id);

      if (!partners || partners.length === 0) {
        setLoading(false);
        return;
      }

      const typedPartners = partners as PartnerRow[];

      // Stat cards
      const active = typedPartners.filter((p) => p.status === "active").length;
      const onboarding = typedPartners.filter((p) => !p.onboarding_completed).length;
      setActivePartners(active);
      setOnboardingPartners(onboarding);

      // MTD revenue from orders for this rep's partners
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const partnerIds = typedPartners.map((p) => p.id);

      const { data: orders } = await supabase
        .from("orders")
        .select("amount_total, partner_id")
        .in("partner_id", partnerIds)
        .gte("created_at", monthStart);

      const typedOrders = (orders || []) as OrderRow[];
      const revenue = typedOrders.reduce((sum, o) => sum + (o.amount_total || 0), 0) / 100;
      setMtdRevenue(revenue);
      setMtdCommission(revenue * 0.05);

      // Stuck partners: on same onboarding step 3+ days
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const stuck = typedPartners
        .filter(
          (p) =>
            !p.onboarding_completed &&
            p.onboarding_step_updated_at &&
            new Date(p.onboarding_step_updated_at) < threeDaysAgo
        )
        .map((p) => ({
          id: p.id,
          company_name: p.company_name,
          current_onboarding_step: p.current_onboarding_step,
          daysSinceUpdate: Math.floor(
            (Date.now() - new Date(p.onboarding_step_updated_at).getTime()) / (1000 * 60 * 60 * 24)
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
        const partnerRevenue = partnerOrders.reduce((sum, o) => sum + (o.amount_total || 0), 0) / 100;
        return {
          id: p.id,
          company_name: p.company_name,
          tier: p.tier,
          status: p.status,
          mtdDocs: partnerOrders.length,
          mtdRevenue: partnerRevenue,
        };
      });
      setRecentPartners(recentDisplay);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-[#1C3557] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const statCards = [
    { label: "Active Partners", value: activePartners.toString() },
    { label: "Partners in Onboarding", value: onboardingPartners.toString() },
    { label: "MTD Partner Revenue", value: formatCurrency(mtdRevenue) },
    { label: "My MTD Commission", value: formatCurrency(mtdCommission) },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-[#2D2D2D]">
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
            <p className="text-2xl font-bold text-[#1C3557] mt-2">{card.value}</p>
          </div>
        ))}
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
                  <p className="text-sm font-medium text-[#2D2D2D]">{p.company_name}</p>
                  <p className="text-xs text-gray-500">
                    Stuck on Step {p.current_onboarding_step} for {p.daysSinceUpdate} days
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

      {/* Recent Partners Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#2D2D2D]">Recent Partners</h2>
          <Link
            href="/pro/sales/partners"
            className="text-xs font-medium text-[#C9A84C] hover:underline"
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
                    MTD Revenue
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentPartners.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-[#2D2D2D]">{p.company_name}</td>
                    <td className="px-5 py-3">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-[#1C3557]/10 text-[#1C3557] capitalize">
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
                    <td className="px-5 py-3 text-right font-medium text-[#2D2D2D]">
                      {formatCurrency(p.mtdRevenue)}
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
