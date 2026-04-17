"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type TabKey = "overview" | "performance" | "activity" | "notes";

interface PartnerDetail {
  id: string;
  company_name: string;
  owner_name: string;
  email: string;
  plan_tier: string;
  status: string;
  onboarding_step: number;
  certification_completed: boolean;
  white_label_url: string;
  created_at: string;
  updated_at: string;
  last_login: string | null;
  business_url: string;
}

interface OnboardingStep {
  step: number;
  label: string;
  completed: boolean;
  completedAt: string | null;
}

interface MonthlyStats {
  month: string;
  docs: number;
  revenue: number;
}

interface AuditEntry {
  id: string;
  action: string;
  details: string;
  created_at: string;
}

interface NoteEntry {
  id: string;
  content: string;
  author_name: string;
  created_at: string;
}

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "performance", label: "Performance" },
  { key: "activity", label: "Activity" },
  { key: "notes", label: "Notes" },
];

const ONBOARDING_LABELS = [
  "Business Profile",
  "Branding & Logo",
  "Legal Agreements",
  "Billing Setup",
  "White-Label Preview",
  "Training Modules",
  "Certification Exam",
];

const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  onboarding: { label: "Onboarding", cls: "bg-blue-100 text-blue-700" },
  active: { label: "Active", cls: "bg-green-100 text-green-700" },
  suspended: { label: "Suspended", cls: "bg-red-100 text-red-700" },
  cancelled: { label: "Cancelled", cls: "bg-gray-100 text-gray-500" },
};

const TIER_STYLES: Record<string, { label: string; cls: string }> = {
  standard: { label: "Standard", cls: "bg-gray-100 text-gray-700" },
  enterprise: { label: "Enterprise", cls: "bg-gold/10 text-gold" },
};

export default function PartnerDetailPage() {
  const params = useParams();
  const partnerId = params["partner-id"] as string;

  const [partner, setPartner] = useState<PartnerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("overview");

  // Performance data
  const [mtdDocs, setMtdDocs] = useState(0);
  const [mtdRevenue, setMtdRevenue] = useState(0);
  const [lmDocs, setLmDocs] = useState(0);
  const [lmRevenue, setLmRevenue] = useState(0);
  const [allDocs, setAllDocs] = useState(0);
  const [allRevenue, setAllRevenue] = useState(0);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);

  // Activity
  const [activity, setActivity] = useState<AuditEntry[]>([]);

  // Notes
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Promo code
  const [promoInput, setPromoInput] = useState("");
  const [promoSaving, setPromoSaving] = useState(false);
  const [promoSaved, setPromoSaved] = useState(false);

  // Actions
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    loadPartner();
  }, [partnerId]);

  async function loadPartner() {
    const supabase = createClient();
    const { data } = await supabase
      .from("partners")
      .select("*")
      .eq("id", partnerId)
      .single();

    if (data) {
      setPartner(data as unknown as PartnerDetail);
      await Promise.all([
        loadPerformance(supabase, partnerId),
        loadActivity(supabase, partnerId),
        loadNotes(supabase, partnerId),
      ]);
    }
    setLoading(false);
  }

  async function loadPerformance(supabase: ReturnType<typeof createClient>, pid: string) {
    const now = new Date();
    const mtdStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const lmStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const lmEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

    // MTD
    const { data: mtdData } = await supabase.from("orders").select("partner_cut").eq("partner_id", pid).gte("created_at", mtdStart);
    setMtdDocs((mtdData || []).length);
    setMtdRevenue((mtdData || []).reduce((s, o) => s + (o.partner_cut || 0), 0));

    // Last month
    const { data: lmData } = await supabase.from("orders").select("partner_cut").eq("partner_id", pid).gte("created_at", lmStart).lte("created_at", lmEnd);
    setLmDocs((lmData || []).length);
    setLmRevenue((lmData || []).reduce((s, o) => s + (o.partner_cut || 0), 0));

    // All time
    const { data: allData } = await supabase.from("orders").select("partner_cut").eq("partner_id", pid);
    setAllDocs((allData || []).length);
    setAllRevenue((allData || []).reduce((s, o) => s + (o.partner_cut || 0), 0));

    // Monthly chart (6 months)
    const months: MonthlyStats[] = [];
    for (let i = 5; i >= 0; i--) {
      const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const { data: mData } = await supabase
        .from("orders")
        .select("partner_cut")
        .eq("partner_id", pid)
        .gte("created_at", mStart.toISOString())
        .lte("created_at", mEnd.toISOString());
      months.push({
        month: mStart.toLocaleString("default", { month: "short" }),
        docs: (mData || []).length,
        revenue: (mData || []).reduce((s, o) => s + (o.partner_cut || 0), 0),
      });
    }
    setMonthlyStats(months);
  }

  async function loadActivity(supabase: ReturnType<typeof createClient>, pid: string) {
    const { data } = await supabase
      .from("audit_log")
      .select("id, action, details, created_at")
      .eq("partner_id", pid)
      .order("created_at", { ascending: false })
      .limit(50);
    setActivity((data || []) as AuditEntry[]);
  }

  async function loadNotes(supabase: ReturnType<typeof createClient>, pid: string) {
    const { data } = await supabase
      .from("sales_partner_notes")
      .select("id, content, author_name, created_at")
      .eq("partner_id", pid)
      .order("created_at", { ascending: false });
    setNotes((data || []) as NoteEntry[]);
  }

  async function handleAddNote() {
    if (!newNote.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch("/api/sales/partner-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerId, content: newNote }),
      });
      if (res.ok) {
        const supabase = createClient();
        await loadNotes(supabase, partnerId);
        setNewNote("");
      }
    } catch {
      // silent
    }
    setSavingNote(false);
  }

  async function handleToggleStatus() {
    if (!partner) return;
    const newStatus = partner.status === "suspended" ? "active" : "suspended";
    const msg = newStatus === "suspended"
      ? "Are you sure you want to suspend this partner?"
      : "Reactivate this partner?";
    if (!confirm(msg)) return;

    setToggling(true);
    const supabase = createClient();
    await supabase.from("partners").update({ status: newStatus }).eq("id", partnerId);
    setPartner((prev) => prev ? { ...prev, status: newStatus } : prev);
    setToggling(false);
  }

  async function handleApplyPromo() {
    if (!promoInput.trim()) return;
    setPromoSaving(true);
    setPromoSaved(false);
    const supabase = createClient();
    const upper = promoInput.trim().toUpperCase();
    const VALID_PARTNER_PROMOS: Record<string, boolean> = { FREE676: true };
    if (!VALID_PARTNER_PROMOS[upper]) {
      alert("Invalid promo code.");
      setPromoSaving(false);
      return;
    }
    await supabase.from("partners").update({
      promo_code: upper,
      one_time_fee_paid: true,
      onboarding_step: Math.max((partner as unknown as { onboarding_step: number })?.onboarding_step || 1, 2),
    }).eq("id", partnerId);
    setPromoSaved(true);
    setPromoSaving(false);
  }

  function handleNudge() {
    alert("Nudge email would be sent to " + partner?.email + ". (Not yet connected.)");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="py-16 text-center">
        <h2 className="text-lg font-semibold text-charcoal">Partner not found</h2>
        <Link href="/pro/sales/partners" className="text-gold text-sm mt-2 inline-block">Back to partners</Link>
      </div>
    );
  }

  const sStatus = STATUS_STYLES[partner.status] || STATUS_STYLES.onboarding;
  const sTier = TIER_STYLES[partner.plan_tier] || TIER_STYLES.standard;

  const onboardingSteps: OnboardingStep[] = ONBOARDING_LABELS.map((label, i) => ({
    step: i + 1,
    label,
    completed: (partner.onboarding_step || 0) > i + 1 || (partner.onboarding_step === i + 1 && partner.status !== "onboarding"),
    completedAt: null,
  }));

  const maxRevenue = Math.max(...monthlyStats.map((m) => m.revenue), 1);

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <Link href="/pro/sales/partners" className="hover:text-gold transition">Partners</Link>
        <span>/</span>
        <span className="text-charcoal font-medium">{partner.company_name}</span>
      </nav>

      {/* Header Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-charcoal">{partner.company_name}</h1>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${sTier.cls}`}>{sTier.label}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${sStatus.cls}`}>{sStatus.label}</span>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-500">
              <span>{partner.owner_name}</span>
              <span>{partner.email}</span>
              {(partner.white_label_url || partner.business_url) && (
                <span className="text-gold">{partner.white_label_url || partner.business_url}</span>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              onClick={handleNudge}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
            >
              Send Nudge Email
            </button>
            <button
              onClick={handleToggleStatus}
              disabled={toggling}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 ${
                partner.status === "suspended"
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-red-600 text-white hover:bg-red-700"
              }`}
            >
              {toggling
                ? "Updating..."
                : partner.status === "suspended"
                ? "Reactivate Partner"
                : "Suspend Partner"}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-0 -mb-px">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition ${
                tab === t.key
                  ? "border-gold text-navy"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ====== OVERVIEW TAB ====== */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Onboarding Checklist */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-navy uppercase tracking-wider mb-4">Onboarding Progress</h3>
            <div className="space-y-3">
              {onboardingSteps.map((s) => (
                <div key={s.step} className="flex items-center gap-3">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                      s.completed
                        ? "bg-green-100"
                        : s.step === partner.onboarding_step
                        ? "bg-gold/10"
                        : "bg-gray-100"
                    }`}
                  >
                    {s.completed ? (
                      <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className={`text-xs font-semibold ${s.step === partner.onboarding_step ? "text-gold" : "text-gray-400"}`}>
                        {s.step}
                      </span>
                    )}
                  </div>
                  <span className={`text-sm ${s.completed ? "text-green-700 font-medium" : s.step === partner.onboarding_step ? "text-charcoal font-medium" : "text-gray-400"}`}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Status Summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h3 className="text-sm font-semibold text-navy uppercase tracking-wider mb-2">Status</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Certification</span>
                <span className={`text-sm font-medium ${partner.certification_completed ? "text-green-600" : "text-gray-400"}`}>
                  {partner.certification_completed ? "Completed" : "Pending"}
                </span>
              </div>
              <div className="h-px bg-gray-100" />
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Last Login</span>
                <span className="text-sm text-charcoal">
                  {partner.last_login
                    ? new Date(partner.last_login).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                    : "Never"}
                </span>
              </div>
              <div className="h-px bg-gray-100" />
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Created</span>
                <span className="text-sm text-charcoal">
                  {new Date(partner.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
              <div className="h-px bg-gray-100" />
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Plan Tier</span>
                <span className="text-sm font-medium text-charcoal capitalize">{partner.plan_tier || "standard"}</span>
              </div>
            </div>
          </div>

          {/* Promo Code */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 lg:col-span-2">
            <h3 className="text-sm font-semibold text-navy uppercase tracking-wider mb-3">Promo Code</h3>
            <div className="flex items-center gap-3">
              <input
                value={promoInput}
                onChange={(e) => { setPromoInput(e.target.value); setPromoSaved(false); }}
                placeholder="Enter promo code (e.g. Free676)"
                className="flex-1 max-w-xs border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold"
              />
              <button
                onClick={handleApplyPromo}
                disabled={promoSaving || !promoInput.trim()}
                className="px-5 py-2 rounded-lg bg-gold text-white text-sm font-semibold hover:bg-gold-600 transition disabled:opacity-50"
              >
                {promoSaving ? "Applying..." : "Apply"}
              </button>
              {promoSaved && <span className="text-sm text-green-600">&#10003; Applied, platform fee waived, partner skips Step 1</span>}
            </div>
          </div>
        </div>
      )}

      {/* ====== PERFORMANCE TAB ====== */}
      {tab === "performance" && (
        <div className="space-y-6">
          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: "Month to Date", docs: mtdDocs, revenue: mtdRevenue },
              { label: "Last Month", docs: lmDocs, revenue: lmRevenue },
              { label: "All Time", docs: allDocs, revenue: allRevenue },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">{s.label}</p>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-2xl font-bold text-charcoal">{s.docs}</p>
                    <p className="text-xs text-gray-400 mt-0.5">documents</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-navy">${s.revenue.toLocaleString()}</p>
                    <p className="text-xs text-gray-400 mt-0.5">revenue</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Bar Chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-navy uppercase tracking-wider mb-6">Revenue (Last 6 Months)</h3>
            <div className="flex items-end gap-3 h-48">
              {monthlyStats.map((m) => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-xs font-medium text-charcoal">${m.revenue.toLocaleString()}</span>
                  <div className="w-full flex justify-center">
                    <div
                      className="w-10 rounded-t-md bg-navy transition-all"
                      style={{
                        height: `${Math.max((m.revenue / maxRevenue) * 140, 4)}px`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-gray-400">{m.month}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ====== ACTIVITY TAB ====== */}
      {tab === "activity" && (
        <div className="bg-white rounded-xl border border-gray-200">
          {activity.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm text-gray-400">No activity recorded yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {activity.map((a) => (
                <div key={a.id} className="px-6 py-4 flex items-start gap-4">
                  <div className="w-2 h-2 rounded-full bg-gold mt-2 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-charcoal font-medium">{a.action}</p>
                    {a.details && <p className="text-xs text-gray-400 mt-0.5">{a.details}</p>}
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">
                    {new Date(a.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ====== NOTES TAB ====== */}
      {tab === "notes" && (
        <div className="space-y-4">
          {/* Add Note */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-navy uppercase tracking-wider mb-3">Add Internal Note</h3>
            <div className="flex gap-3">
              <input
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
                placeholder="Type a note..."
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold"
              />
              <button
                onClick={handleAddNote}
                disabled={savingNote || !newNote.trim()}
                className="px-5 py-2 rounded-lg bg-gold text-white text-sm font-semibold hover:bg-gold-600 transition disabled:opacity-50"
              >
                {savingNote ? "Saving..." : "Add Note"}
              </button>
            </div>
          </div>

          {/* Notes List */}
          {notes.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <p className="text-sm text-gray-400">No notes yet. Add the first one above.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map((n) => (
                <div key={n.id} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-charcoal flex-1">{n.content}</p>
                    <span className="text-xs text-gray-400 shrink-0">
                      {new Date(n.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {n.author_name && (
                    <p className="text-xs text-gray-400 mt-1">- {n.author_name}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
