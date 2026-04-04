"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface Prospect { id: string; company_name: string; contact_name: string; email: string; professional_type: string; stage: string; created_at: string }
interface PartnerCard { id: string; company_name: string; tier: string; onboarding_step: number; onboarding_completed: boolean; certification_completed: boolean; status: string; created_at: string }

const MANUAL_STAGES = ["prospect", "contacted", "demo_shown"];
const COLUMNS = [
  { id: "prospect", label: "Prospect", auto: false },
  { id: "contacted", label: "Contacted", auto: false },
  { id: "demo_shown", label: "Demo Shown", auto: false },
  { id: "agreement_sent", label: "Agreement Sent", auto: true },
  { id: "onboarding", label: "Onboarding", auto: true },
  { id: "active", label: "Active", auto: true },
];

export default function PipelinePage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [partners, setPartners] = useState<PartnerCard[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ company_name: "", contact_name: "", email: "", professional_type: "", source: "" });
  const [saving, setSaving] = useState(false);
  const [dragItem, setDragItem] = useState<string | null>(null);
  const [repId, setRepId] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setRepId(user.id);

    const { data: p } = await supabase.from("sales_prospects").select("*").eq("sales_rep_id", user.id).order("created_at", { ascending: false });
    setProspects(p || []);

    const { data: partners } = await supabase.from("partners").select("id, company_name, tier, onboarding_step, onboarding_completed, certification_completed, status, created_at").eq("created_by", user.id);
    setPartners(partners || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addProspect() {
    if (!form.company_name) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from("sales_prospects").insert({ ...form, sales_rep_id: repId, stage: "prospect" });
    setForm({ company_name: "", contact_name: "", email: "", professional_type: "", source: "" });
    setShowAdd(false);
    await load();
    setSaving(false);
  }

  async function moveProspect(id: string, newStage: string) {
    if (!MANUAL_STAGES.includes(newStage)) return;
    const supabase = createClient();
    await supabase.from("sales_prospects").update({ stage: newStage }).eq("id", id);
    await load();
  }

  function getColumnCards(columnId: string) {
    if (columnId === "prospect" || columnId === "contacted" || columnId === "demo_shown") {
      return prospects.filter((p) => p.stage === columnId).map((p) => ({
        id: p.id, name: p.company_name, sub: p.professional_type || p.email, date: p.created_at, type: "prospect" as const,
      }));
    }
    if (columnId === "agreement_sent") {
      return partners.filter((p) => !p.onboarding_completed && p.onboarding_step <= 1 && p.status === "onboarding").map((p) => ({
        id: p.id, name: p.company_name, sub: p.tier, date: p.created_at, type: "partner" as const,
      }));
    }
    if (columnId === "onboarding") {
      return partners.filter((p) => !p.onboarding_completed && p.onboarding_step > 1 && p.status === "onboarding").map((p) => ({
        id: p.id, name: p.company_name, sub: `Step ${p.onboarding_step} of 7`, date: p.created_at, type: "partner" as const,
      }));
    }
    if (columnId === "active") {
      return partners.filter((p) => p.status === "active").map((p) => ({
        id: p.id, name: p.company_name, sub: p.certification_completed ? "Certified" : "Not certified", date: p.created_at, type: "partner" as const,
      }));
    }
    return [];
  }

  function daysSince(date: string) { return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24)); }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-navy">Pipeline</h1>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const cards = getColumnCards(col.id);
          return (
            <div key={col.id} className="flex-shrink-0 w-64"
              onDragOver={(e) => { if (MANUAL_STAGES.includes(col.id)) e.preventDefault(); }}
              onDrop={() => { if (dragItem && MANUAL_STAGES.includes(col.id)) moveProspect(dragItem, col.id); setDragItem(null); }}>
              <div className="bg-navy rounded-t-lg px-3 py-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-white">{col.label}</span>
                <span className="text-xs text-white/50">{cards.length}</span>
              </div>
              <div className="bg-gray-100 rounded-b-lg min-h-[300px] p-2 space-y-2">
                {col.id === "prospect" && (
                  <button onClick={() => setShowAdd(true)} className="w-full rounded-lg border-2 border-dashed border-gray-300 py-2 text-xs text-charcoal/50 hover:border-gold/40 hover:text-gold">+ Add Prospect</button>
                )}
                {cards.map((card) => {
                  const days = daysSince(card.date);
                  return (
                    <div key={card.id}
                      draggable={card.type === "prospect"}
                      onDragStart={() => card.type === "prospect" && setDragItem(card.id)}
                      className={`rounded-lg bg-white border border-gray-200 p-3 shadow-sm ${card.type === "prospect" ? "cursor-grab" : ""} ${days > 7 ? "border-l-2 border-l-amber-400" : ""}`}>
                      <p className="text-sm font-semibold text-navy truncate">{card.name}</p>
                      <p className="text-xs text-charcoal/50 mt-1 truncate">{card.sub}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className={`text-xs ${days > 7 ? "text-amber-600 font-medium" : "text-charcoal/60"}`}>{days}d</span>
                        {card.type === "partner" && (
                          <a href={`/sales/partners/${card.id}`} className="text-xs text-gold hover:text-gold/80">View</a>
                        )}
                      </div>
                    </div>
                  );
                })}
                {cards.length === 0 && col.id !== "prospect" && (
                  <p className="text-xs text-charcoal/60 text-center py-8">Empty</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add prospect modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowAdd(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl p-6 shadow-xl">
            <h2 className="text-lg font-bold text-navy">Add Prospect</h2>
            <div className="mt-4 space-y-3">
              <input type="text" value={form.company_name} onChange={(e) => setForm((p) => ({ ...p, company_name: e.target.value }))} placeholder="Company name *" className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none" />
              <input type="text" value={form.contact_name} onChange={(e) => setForm((p) => ({ ...p, contact_name: e.target.value }))} placeholder="Contact name" className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none" />
              <input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="Email" className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none" />
              <select value={form.professional_type} onChange={(e) => setForm((p) => ({ ...p, professional_type: e.target.value }))} className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none">
                <option value="">Professional type</option>
                {["Financial Advisor", "CPA / Accountant", "Insurance Agent", "Attorney", "Other"].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={form.source} onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))} className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none">
                <option value="">Source</option>
                {["Cold Outreach", "Referral", "Conference", "Existing Relationship", "Inbound Lead", "Other"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={addProspect} disabled={saving || !form.company_name} className="w-full min-h-[44px] rounded-full bg-gold py-3 text-sm font-semibold text-white hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed">
                {saving ? "Adding..." : "Add Prospect"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
