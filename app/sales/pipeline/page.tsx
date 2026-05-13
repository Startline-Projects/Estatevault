"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePortalBase } from "@/lib/portal-base";

interface Prospect {
  id: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  professional_type: string | null;
  source: string | null;
  notes: string | null;
  stage: string;
  next_action_at: string | null;
  last_contacted_at: string | null;
  created_at: string;
}
interface PartnerCard {
  id: string;
  company_name: string;
  tier: string;
  onboarding_step: number;
  onboarding_completed: boolean;
  certification_completed: boolean;
  status: string;
  created_at: string;
}
interface Activity {
  id: string;
  prospect_id: string;
  type: string;
  body: string | null;
  created_at: string;
}
type Card = {
  id: string;
  name: string;
  sub: string;
  date: string;
  type: "prospect" | "partner";
  raw: Prospect | PartnerCard;
};

const MANUAL_STAGES = ["prospect", "contacted", "demo_shown"] as const;
const COLUMNS = [
  { id: "prospect", label: "Prospect", auto: false, hint: "Cold leads" },
  { id: "contacted", label: "Contacted", auto: false, hint: "Outreach made" },
  { id: "demo_shown", label: "Demo Shown", auto: false, hint: "Demo delivered" },
  { id: "agreement_sent", label: "Agreement Sent", auto: true, hint: "Partner created" },
  { id: "onboarding", label: "Onboarding", auto: true, hint: "In setup" },
  { id: "active", label: "Active", auto: true, hint: "Live partner" },
] as const;

const PRO_TYPES = ["Financial Advisor", "CPA / Accountant", "Insurance Agent", "Attorney", "Other"];
const SOURCES = ["Cold Outreach", "Referral", "Conference", "Existing Relationship", "Inbound Lead", "Other"];

function daysSince(date: string) {
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
}

export default function PipelinePage() {
  const portalBase = usePortalBase();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [partners, setPartners] = useState<PartnerCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ company_name: "", contact_name: "", email: "", phone: "", professional_type: "", source: "" });
  const [saving, setSaving] = useState(false);
  const [dragItem, setDragItem] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [repId, setRepId] = useState("");

  const [search, setSearch] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterType, setFilterType] = useState("");
  const [stalledOnly, setStalledOnly] = useState(false);

  // Drawer
  const [openCard, setOpenCard] = useState<Card | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Prospect>>({});

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setRepId(user.id);

    const [{ data: p }, { data: pa }] = await Promise.all([
      supabase.from("sales_prospects").select("*").eq("sales_rep_id", user.id).order("created_at", { ascending: false }),
      supabase
        .from("partners")
        .select("id, company_name, tier, onboarding_step, onboarding_completed, certification_completed, status, created_at")
        .eq("created_by", user.id),
    ]);
    setProspects(p || []);
    setPartners(pa || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function loadActivity(prospectId: string) {
    const supabase = createClient();
    const { data } = await supabase
      .from("sales_prospect_activity")
      .select("*")
      .eq("prospect_id", prospectId)
      .order("created_at", { ascending: false });
    setActivity(data || []);
  }

  async function logActivity(prospectId: string, type: string, body: string | null) {
    const supabase = createClient();
    const { error } = await supabase.from("sales_prospect_activity").insert({ prospect_id: prospectId, sales_rep_id: repId, type, body });
    if (error) console.warn("Activity log skipped (migration not run?):", error.message);
  }

  async function addProspect() {
    if (!form.company_name) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from("sales_prospects").insert({ ...form, sales_rep_id: repId, stage: "prospect" });
    setForm({ company_name: "", contact_name: "", email: "", phone: "", professional_type: "", source: "" });
    setShowAdd(false);
    await load();
    setSaving(false);
  }

  async function moveProspect(id: string, newStage: string) {
    if (!(MANUAL_STAGES as readonly string[]).includes(newStage)) return;
    const cur = prospects.find((p) => p.id === id);
    if (!cur || cur.stage === newStage) return;

    // Optimistic update — move card immediately
    const nowIso = new Date().toISOString();
    setProspects((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, stage: newStage, ...(newStage === "contacted" ? { last_contacted_at: nowIso } : {}) }
          : p
      )
    );

    const supabase = createClient();
    // Try full update first; if last_contacted_at column missing, retry with stage only
    let { error } = await supabase
      .from("sales_prospects")
      .update(newStage === "contacted" ? { stage: newStage, last_contacted_at: nowIso } : { stage: newStage })
      .eq("id", id);

    if (error && /last_contacted_at/.test(error.message)) {
      ({ error } = await supabase.from("sales_prospects").update({ stage: newStage }).eq("id", id));
    }

    if (error) {
      console.error("Stage update failed:", error.message);
      // Roll back optimistic move
      setProspects((prev) => prev.map((p) => (p.id === id ? cur : p)));
      return;
    }

    // Log activity in background; don't block UI
    logActivity(id, "stage_change", `${cur.stage} → ${newStage}`);
  }

  async function deleteProspect(id: string) {
    if (!confirm("Delete this prospect? Activity log will be removed too.")) return;
    const supabase = createClient();
    await supabase.from("sales_prospects").delete().eq("id", id);
    setOpenCard(null);
    await load();
  }

  async function saveEdit() {
    if (!openCard) return;
    const supabase = createClient();
    await supabase.from("sales_prospects").update(editForm).eq("id", openCard.id);
    setEditing(false);
    await load();
    const fresh = (await supabase.from("sales_prospects").select("*").eq("id", openCard.id).single()).data;
    if (fresh) setOpenCard({ ...openCard, raw: fresh, name: fresh.company_name, sub: fresh.professional_type || fresh.email || "" });
  }

  async function addNote() {
    if (!openCard || !noteDraft.trim()) return;
    await logActivity(openCard.id, "note", noteDraft.trim());
    setNoteDraft("");
    await loadActivity(openCard.id);
  }

  // Filtering
  function passesFilter(p: Prospect | PartnerCard, isPartner: boolean) {
    if (search) {
      const q = search.toLowerCase();
      const name = (p as Prospect).company_name?.toLowerCase() || "";
      const contact = isPartner ? "" : ((p as Prospect).contact_name?.toLowerCase() || "");
      const email = isPartner ? "" : ((p as Prospect).email?.toLowerCase() || "");
      if (!name.includes(q) && !contact.includes(q) && !email.includes(q)) return false;
    }
    if (!isPartner) {
      const pr = p as Prospect;
      if (filterSource && pr.source !== filterSource) return false;
      if (filterType && pr.professional_type !== filterType) return false;
    }
    if (stalledOnly && daysSince((p as { created_at: string }).created_at) <= 7) return false;
    return true;
  }

  function getColumnCards(columnId: string): Card[] {
    if (columnId === "prospect" || columnId === "contacted" || columnId === "demo_shown") {
      return prospects
        .filter((p) => p.stage === columnId && passesFilter(p, false))
        .map((p) => ({
          id: p.id,
          name: p.company_name,
          sub: p.professional_type || p.email || "",
          date: p.created_at,
          type: "prospect" as const,
          raw: p,
        }));
    }
    if (columnId === "agreement_sent") {
      return partners
        .filter((p) => !p.onboarding_completed && p.onboarding_step <= 1 && p.status === "onboarding" && passesFilter(p, true))
        .map((p) => ({ id: p.id, name: p.company_name, sub: p.tier, date: p.created_at, type: "partner" as const, raw: p }));
    }
    if (columnId === "onboarding") {
      return partners
        .filter((p) => !p.onboarding_completed && p.onboarding_step > 1 && p.status === "onboarding" && passesFilter(p, true))
        .map((p) => ({ id: p.id, name: p.company_name, sub: `Step ${p.onboarding_step} of 7`, date: p.created_at, type: "partner" as const, raw: p }));
    }
    if (columnId === "active") {
      return partners
        .filter((p) => p.status === "active" && passesFilter(p, true))
        .map((p) => ({ id: p.id, name: p.company_name, sub: p.certification_completed ? "Certified" : "Not certified", date: p.created_at, type: "partner" as const, raw: p }));
    }
    return [];
  }

  // Metrics
  const metrics = useMemo(() => {
    const totalProspects = prospects.length;
    const totalPartners = partners.length;
    const active = partners.filter((p) => p.status === "active").length;
    const stalled = prospects.filter((p) => daysSince(p.created_at) > 7).length;
    const conversion = totalProspects + totalPartners > 0
      ? Math.round((active / (totalProspects + totalPartners)) * 100)
      : 0;
    return { totalProspects, totalPartners, active, stalled, conversion };
  }, [prospects, partners]);

  function openDrawer(card: Card) {
    setOpenCard(card);
    setEditing(false);
    setEditForm({});
    if (card.type === "prospect") loadActivity(card.id);
    else setActivity([]);
  }

  function startEdit() {
    if (!openCard || openCard.type !== "prospect") return;
    const p = openCard.raw as Prospect;
    setEditForm({
      company_name: p.company_name,
      contact_name: p.contact_name,
      email: p.email,
      phone: p.phone,
      professional_type: p.professional_type,
      source: p.source,
      notes: p.notes,
      next_action_at: p.next_action_at,
    });
    setEditing(true);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-navy">Pipeline</h1>
          <p className="text-xs text-charcoal/50 mt-0.5">Track partner acquisition from cold lead to live partner.</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-white hover:bg-gold/90 transition-colors min-h-[44px]"
        >
          <span className="text-base leading-none">+</span> Add Prospect
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <MetricCard label="Prospects" value={metrics.totalProspects} hint="In manual stages" />
        <MetricCard label="Partners" value={metrics.totalPartners} hint="Created" />
        <MetricCard label="Active" value={metrics.active} hint="Live partners" />
        <MetricCard label="Stalled" value={metrics.stalled} accent={metrics.stalled > 0 ? "amber" : undefined} hint=">7 days idle" />
        <MetricCard label="Conversion" value={`${metrics.conversion}%`} hint="To active" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company, contact, email..."
            className="w-full min-h-[40px] rounded-xl border-2 border-gray-200 px-4 text-sm focus:border-gold focus:outline-none"
          />
        </div>
        <select
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value)}
          className="min-h-[40px] rounded-xl border-2 border-gray-200 px-3 text-sm focus:border-gold focus:outline-none"
        >
          <option value="">All sources</option>
          {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="min-h-[40px] rounded-xl border-2 border-gray-200 px-3 text-sm focus:border-gold focus:outline-none"
        >
          <option value="">All types</option>
          {PRO_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button
          onClick={() => setStalledOnly((v) => !v)}
          className={`min-h-[40px] rounded-xl border-2 px-3 text-sm font-medium transition-colors ${
            stalledOnly ? "border-amber-400 bg-amber-50 text-amber-700" : "border-gray-200 text-charcoal/60 hover:border-gold/40"
          }`}
        >
          {stalledOnly ? "✓ Stalled only" : "Stalled only"}
        </button>
        {(search || filterSource || filterType || stalledOnly) && (
          <button
            onClick={() => { setSearch(""); setFilterSource(""); setFilterType(""); setStalledOnly(false); }}
            className="text-xs text-charcoal/50 hover:text-navy underline"
          >
            Clear
          </button>
        )}
      </div>

      {/* Board */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pb-4">
        {COLUMNS.map((col) => {
          const cards = getColumnCards(col.id);
          const isManual = (MANUAL_STAGES as readonly string[]).includes(col.id);
          const isDropTarget = dragOverCol === col.id && isManual;
          return (
            <div
              key={col.id}
              className="min-w-0"
              onDragOver={(e) => { if (isManual) { e.preventDefault(); setDragOverCol(col.id); } }}
              onDragLeave={() => setDragOverCol((c) => (c === col.id ? null : c))}
              onDrop={() => {
                if (dragItem && isManual) moveProspect(dragItem, col.id);
                setDragItem(null);
                setDragOverCol(null);
              }}
            >
              <div className={`rounded-t-xl px-2 py-2 flex items-center justify-between gap-1 ${col.auto ? "bg-navy/90" : "bg-navy"}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold text-white truncate">{col.label}</span>
                    {col.auto && (
                      <span className="text-[9px] font-medium uppercase tracking-wider text-gold/80 bg-gold/15 rounded px-1 py-0.5 flex-shrink-0">Auto</span>
                    )}
                  </div>
                  <p className="text-[9px] text-white/50 mt-0.5 truncate">{col.hint}</p>
                </div>
                <span className="text-[10px] font-semibold text-white bg-white/10 rounded-full px-1.5 py-0.5 flex-shrink-0">{cards.length}</span>
              </div>
              <div
                className={`rounded-b-xl min-h-[400px] p-1.5 space-y-1.5 transition-colors ${
                  isDropTarget ? "bg-gold/10 ring-2 ring-gold/40" : "bg-gray-50"
                }`}
              >
                {col.id === "prospect" && (
                  <button
                    onClick={() => setShowAdd(true)}
                    className="w-full rounded-lg border-2 border-dashed border-gray-300 py-2.5 text-xs font-medium text-charcoal/50 hover:border-gold hover:text-gold transition-colors"
                  >
                    + Add Prospect
                  </button>
                )}
                {cards.map((card) => {
                  const days = daysSince(card.date);
                  const stalled = days > 7;
                  return (
                    <div
                      key={card.id}
                      draggable={card.type === "prospect"}
                      onDragStart={() => card.type === "prospect" && setDragItem(card.id)}
                      onDragEnd={() => { setDragItem(null); setDragOverCol(null); }}
                      onClick={() => openDrawer(card)}
                      className={`group rounded-lg bg-white border p-2 shadow-sm hover:shadow-md hover:border-gold/40 cursor-pointer transition-all ${
                        stalled ? "border-amber-300 border-l-4 border-l-amber-400" : "border-gray-200"
                      } ${dragItem === card.id ? "opacity-50" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <p className="text-xs font-semibold text-navy truncate leading-tight">{card.name}</p>
                        {card.type === "prospect" && (
                          <span className="text-[9px] text-charcoal/30 group-hover:text-gold transition-colors flex-shrink-0">⋮⋮</span>
                        )}
                      </div>
                      <p className="text-[10px] text-charcoal/50 mt-1 truncate">{card.sub || "—"}</p>
                      <div className="mt-1.5 flex items-center justify-between gap-1">
                        <span className={`text-[10px] font-medium ${stalled ? "text-amber-600" : "text-charcoal/50"}`}>
                          {stalled && "⚠ "}{days}d
                        </span>
                        {card.type === "partner" && (
                          <a
                            href={`${portalBase}/partners/${card.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-[10px] font-medium text-gold hover:text-gold/80"
                          >
                            View →
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
                {cards.length === 0 && col.id !== "prospect" && (
                  <div className="text-xs text-charcoal/40 text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
                    Empty
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add modal */}
      {showAdd && (
        <Modal onClose={() => setShowAdd(false)} title="Add Prospect">
          <div className="space-y-3">
            <Input value={form.company_name} onChange={(v) => setForm((p) => ({ ...p, company_name: v }))} placeholder="Company name *" />
            <Input value={form.contact_name} onChange={(v) => setForm((p) => ({ ...p, contact_name: v }))} placeholder="Contact name" />
            <Input type="email" value={form.email} onChange={(v) => setForm((p) => ({ ...p, email: v }))} placeholder="Email" />
            <Input type="tel" value={form.phone} onChange={(v) => setForm((p) => ({ ...p, phone: v }))} placeholder="Phone" />
            <Select value={form.professional_type} onChange={(v) => setForm((p) => ({ ...p, professional_type: v }))} placeholder="Professional type" options={PRO_TYPES} />
            <Select value={form.source} onChange={(v) => setForm((p) => ({ ...p, source: v }))} placeholder="Source" options={SOURCES} />
            <button
              onClick={addProspect}
              disabled={saving || !form.company_name}
              className="w-full min-h-[44px] rounded-full bg-gold py-3 text-sm font-semibold text-white hover:bg-gold/90 disabled:opacity-50"
            >
              {saving ? "Adding..." : "Add Prospect"}
            </button>
          </div>
        </Modal>
      )}

      {/* Drawer */}
      {openCard && (
        <Drawer onClose={() => setOpenCard(null)}>
          <ProspectDrawer
            card={openCard}
            activity={activity}
            editing={editing}
            editForm={editForm}
            setEditForm={setEditForm}
            startEdit={startEdit}
            saveEdit={saveEdit}
            cancelEdit={() => setEditing(false)}
            noteDraft={noteDraft}
            setNoteDraft={setNoteDraft}
            addNote={addNote}
            onDelete={() => deleteProspect(openCard.id)}
            onAdvance={async (stage) => { await moveProspect(openCard.id, stage); setOpenCard(null); }}
            portalBase={portalBase}
          />
        </Drawer>
      )}
    </div>
  );
}

function MetricCard({ label, value, hint, accent }: { label: string; value: number | string; hint?: string; accent?: "amber" }) {
  return (
    <div className={`rounded-xl border bg-white p-3 ${accent === "amber" ? "border-amber-300" : "border-gray-200"}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-charcoal/50">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent === "amber" ? "text-amber-600" : "text-navy"}`}>{value}</p>
      {hint && <p className="text-[10px] text-charcoal/40 mt-0.5">{hint}</p>}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder: string; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none"
    />
  );
}

function Select({ value, onChange, placeholder, options }: { value: string; onChange: (v: string) => void; placeholder: string; options: string[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-navy">{title}</h2>
          <button onClick={onClose} className="text-charcoal/40 hover:text-navy text-xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Drawer({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl overflow-y-auto animate-[slideIn_0.2s_ease-out]">
        <style jsx>{`
          @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        `}</style>
        {children}
      </div>
    </div>
  );
}

function ProspectDrawer({
  card, activity, editing, editForm, setEditForm, startEdit, saveEdit, cancelEdit,
  noteDraft, setNoteDraft, addNote, onDelete, onAdvance, portalBase,
}: {
  card: Card;
  activity: Activity[];
  editing: boolean;
  editForm: Partial<Prospect>;
  setEditForm: (f: Partial<Prospect>) => void;
  startEdit: () => void;
  saveEdit: () => void;
  cancelEdit: () => void;
  noteDraft: string;
  setNoteDraft: (s: string) => void;
  addNote: () => void;
  onDelete: () => void;
  onAdvance: (stage: string) => void;
  portalBase: string;
}) {
  const isProspect = card.type === "prospect";
  const p = isProspect ? (card.raw as Prospect) : null;
  const partner = !isProspect ? (card.raw as PartnerCard) : null;

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-1">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gold">
            {isProspect ? `Prospect • ${p!.stage.replace("_", " ")}` : `Partner • ${partner!.status}`}
          </p>
          <h2 className="text-xl font-bold text-navy mt-0.5">{card.name}</h2>
        </div>
      </div>
      <p className="text-xs text-charcoal/50 mb-5">
        Added {new Date(card.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} • {daysSince(card.date)}d ago
      </p>

      {/* Partner: just info + link */}
      {partner && (
        <div className="space-y-4">
          <Row label="Tier" value={partner.tier} />
          <Row label="Onboarding" value={partner.onboarding_completed ? "Complete" : `Step ${partner.onboarding_step} of 7`} />
          <Row label="Certification" value={partner.certification_completed ? "Certified" : "Not certified"} />
          <a
            href={`${portalBase}/partners/${partner.id}`}
            className="block w-full text-center rounded-full bg-gold py-3 text-sm font-semibold text-white hover:bg-gold/90"
          >
            Open Partner Page →
          </a>
        </div>
      )}

      {/* Prospect */}
      {p && (
        <>
          {!editing ? (
            <>
              {/* Quick actions */}
              <div className="grid grid-cols-2 gap-2 mb-5">
                {p.stage === "prospect" && (
                  <button onClick={() => onAdvance("contacted")} className="rounded-lg bg-navy py-2.5 text-xs font-semibold text-white hover:bg-navy/90">
                    Mark Contacted
                  </button>
                )}
                {p.stage === "contacted" && (
                  <button onClick={() => onAdvance("demo_shown")} className="rounded-lg bg-navy py-2.5 text-xs font-semibold text-white hover:bg-navy/90">
                    Mark Demo Shown
                  </button>
                )}
                {p.stage === "demo_shown" && (
                  <div className="rounded-lg bg-gold/10 py-2.5 text-xs font-semibold text-gold text-center">
                    Ready → Convert to partner
                  </div>
                )}
                <button onClick={startEdit} className="rounded-lg border border-gray-200 py-2.5 text-xs font-semibold text-charcoal/70 hover:bg-gray-50">
                  Edit
                </button>
              </div>

              {/* Info */}
              <div className="space-y-2 mb-5">
                <Row label="Contact" value={p.contact_name || "—"} />
                <Row label="Email" value={p.email || "—"} />
                <Row label="Phone" value={p.phone || "—"} />
                <Row label="Type" value={p.professional_type || "—"} />
                <Row label="Source" value={p.source || "—"} />
                <Row label="Last contacted" value={p.last_contacted_at ? new Date(p.last_contacted_at).toLocaleDateString() : "—"} />
                <Row label="Next action" value={p.next_action_at ? new Date(p.next_action_at).toLocaleDateString() : "—"} />
              </div>

              {p.notes && (
                <div className="mb-5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-charcoal/50 mb-1">Notes</p>
                  <p className="text-sm text-charcoal/80 whitespace-pre-wrap rounded-lg bg-gray-50 p-3">{p.notes}</p>
                </div>
              )}

              {/* Activity log */}
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-charcoal/50 mb-2">Activity</p>
                <div className="flex gap-2 mb-2">
                  <input
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="Log a note, call, email..."
                    onKeyDown={(e) => e.key === "Enter" && addNote()}
                    className="flex-1 min-h-[40px] rounded-lg border-2 border-gray-200 px-3 text-sm focus:border-gold focus:outline-none"
                  />
                  <button onClick={addNote} disabled={!noteDraft.trim()} className="rounded-lg bg-gold px-4 text-xs font-semibold text-white hover:bg-gold/90 disabled:opacity-50">
                    Add
                  </button>
                </div>
                {activity.length === 0 ? (
                  <p className="text-xs text-charcoal/40 text-center py-4">No activity yet.</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {activity.map((a) => (
                      <div key={a.id} className="rounded-lg border border-gray-100 p-2.5 text-xs">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-semibold text-navy uppercase tracking-wider text-[10px]">{a.type.replace("_", " ")}</span>
                          <span className="text-charcoal/40">{new Date(a.created_at).toLocaleDateString()}</span>
                        </div>
                        {a.body && <p className="text-charcoal/70 whitespace-pre-wrap">{a.body}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={onDelete}
                className="w-full rounded-lg border border-red-200 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                Delete Prospect
              </button>
            </>
          ) : (
            <div className="space-y-3">
              <Input value={editForm.company_name || ""} onChange={(v) => setEditForm({ ...editForm, company_name: v })} placeholder="Company *" />
              <Input value={editForm.contact_name || ""} onChange={(v) => setEditForm({ ...editForm, contact_name: v })} placeholder="Contact name" />
              <Input type="email" value={editForm.email || ""} onChange={(v) => setEditForm({ ...editForm, email: v })} placeholder="Email" />
              <Input type="tel" value={editForm.phone || ""} onChange={(v) => setEditForm({ ...editForm, phone: v })} placeholder="Phone" />
              <Select value={editForm.professional_type || ""} onChange={(v) => setEditForm({ ...editForm, professional_type: v })} placeholder="Professional type" options={PRO_TYPES} />
              <Select value={editForm.source || ""} onChange={(v) => setEditForm({ ...editForm, source: v })} placeholder="Source" options={SOURCES} />
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-charcoal/50 block mb-1">Next action date</label>
                <input
                  type="date"
                  value={editForm.next_action_at ? editForm.next_action_at.slice(0, 10) : ""}
                  onChange={(e) => setEditForm({ ...editForm, next_action_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                  className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 px-4 text-sm focus:border-gold focus:outline-none"
                />
              </div>
              <textarea
                value={editForm.notes || ""}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="Notes"
                rows={3}
                className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none"
              />
              <div className="flex gap-2">
                <button onClick={cancelEdit} className="flex-1 rounded-full border border-gray-200 py-2.5 text-sm font-semibold text-charcoal/70 hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={saveEdit} className="flex-1 rounded-full bg-gold py-2.5 text-sm font-semibold text-white hover:bg-gold/90">
                  Save
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center gap-3 text-sm">
      <span className="text-charcoal/50 text-xs uppercase tracking-wider font-semibold">{label}</span>
      <span className="text-charcoal/80 text-right truncate">{value}</span>
    </div>
  );
}
