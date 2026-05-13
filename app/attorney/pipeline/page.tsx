"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface ReviewCase {
  id: string;
  order_id: string;
  status: string;
  sla_deadline: string;
  created_at: string;
  product_type: string;
  partner_company: string | null;
  client_name: string | null;
  client_email: string | null;
}

const COLUMNS = [
  { id: "pending", label: "Pending", hint: "Not yet started", color: "bg-gray-500" },
  { id: "in_review", label: "In Review", hint: "Active review", color: "bg-blue-600" },
  { id: "approved", label: "Approved", hint: "Approved / w/ Notes", color: "bg-green-600" },
  { id: "flagged", label: "Flagged", hint: "Returned to client", color: "bg-red-600" },
] as const;

const MANUAL_TRANSITIONS: Record<string, string[]> = {
  pending: ["in_review"],
  in_review: ["pending"],
};

function slaState(deadline: string) {
  const hoursLeft = (new Date(deadline).getTime() - Date.now()) / 3_600_000;
  if (hoursLeft < 0) return { label: `Overdue ${Math.abs(Math.round(hoursLeft))}h`, tone: "red" as const };
  if (hoursLeft < 12) return { label: `${Math.round(hoursLeft)}h left`, tone: "orange" as const };
  const days = Math.floor(hoursLeft / 24);
  return { label: days > 0 ? `${days}d left` : `${Math.round(hoursLeft)}h left`, tone: "gray" as const };
}

export default function AttorneyPipelinePage() {
  const [cases, setCases] = useState<ReviewCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragItem, setDragItem] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: raw } = await supabase
      .from("attorney_reviews")
      .select("id, order_id, status, sla_deadline, created_at")
      .eq("attorney_id", user.id)
      .order("created_at", { ascending: false });

    if (!raw || raw.length === 0) { setCases([]); setLoading(false); return; }

    const orderIds = raw.map((r) => r.order_id).filter(Boolean);
    const { data: orders } = await supabase.from("orders").select("id, product_type, client_id, partner_id").in("id", orderIds);
    const orderMap = Object.fromEntries((orders || []).map((o) => [o.id, o]));

    const clientIds = (orders || []).map((o) => o.client_id).filter(Boolean);
    const { data: clients } = clientIds.length
      ? await supabase.from("clients").select("id, profile_id").in("id", clientIds)
      : { data: [] as { id: string; profile_id: string }[] };
    const clientMap = Object.fromEntries((clients || []).map((c) => [c.id, c]));

    const profileIds = (clients || []).map((c) => c.profile_id).filter(Boolean);
    const { data: profs } = profileIds.length
      ? await supabase.from("profiles").select("id, full_name, email").in("id", profileIds)
      : { data: [] as { id: string; full_name: string; email: string }[] };
    const profMap = Object.fromEntries((profs || []).map((p) => [p.id, p]));

    const partnerIds = (orders || []).map((o) => o.partner_id).filter(Boolean);
    const { data: partners } = partnerIds.length
      ? await supabase.from("partners").select("id, company_name").in("id", partnerIds)
      : { data: [] as { id: string; company_name: string }[] };
    const partnerMap = Object.fromEntries((partners || []).map((p) => [p.id, p]));

    const enriched: ReviewCase[] = raw.map((r) => {
      const o = orderMap[r.order_id];
      const c = o ? clientMap[o.client_id] : null;
      const prof = c ? profMap[c.profile_id] : null;
      const partner = o?.partner_id ? partnerMap[o.partner_id] : null;
      return {
        ...r,
        product_type: o?.product_type || "will",
        partner_company: partner?.company_name || null,
        client_name: prof?.full_name || prof?.email || null,
        client_email: prof?.email || null,
      };
    });

    setCases(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function moveCase(id: string, newStatus: string) {
    const cur = cases.find((c) => c.id === id);
    if (!cur) return;
    const allowed = MANUAL_TRANSITIONS[cur.status] || [];
    if (!allowed.includes(newStatus)) return;
    const supabase = createClient();
    await supabase.from("attorney_reviews").update({ status: newStatus }).eq("id", id);
    await load();
  }

  function passesFilter(c: ReviewCase) {
    if (search) {
      const q = search.toLowerCase();
      const hay = `${c.client_name || ""} ${c.client_email || ""} ${c.partner_company || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (overdueOnly && new Date(c.sla_deadline).getTime() > Date.now()) return false;
    return true;
  }

  function getColumnCases(colId: string) {
    if (colId === "approved") {
      return cases.filter((c) => (c.status === "approved" || c.status === "approved_with_notes") && passesFilter(c));
    }
    return cases.filter((c) => c.status === colId && passesFilter(c));
  }

  const metrics = useMemo(() => {
    const pending = cases.filter((c) => c.status === "pending").length;
    const inReview = cases.filter((c) => c.status === "in_review").length;
    const overdue = cases.filter((c) => new Date(c.sla_deadline).getTime() < Date.now() && (c.status === "pending" || c.status === "in_review")).length;
    const done = cases.filter((c) => ["approved", "approved_with_notes", "flagged"].includes(c.status)).length;
    return { pending, inReview, overdue, done };
  }, [cases]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-navy">Review Pipeline</h1>
          <p className="text-xs text-charcoal/50 mt-0.5">Drag pending → in review. Open a case to approve or flag.</p>
        </div>
        <Link
          href="/attorney/reviews"
          className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-navy px-5 py-2.5 text-sm font-semibold text-navy hover:bg-navy hover:text-white transition-colors min-h-[44px]"
        >
          Table View →
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <MetricCard label="Pending" value={metrics.pending} />
        <MetricCard label="In Review" value={metrics.inReview} />
        <MetricCard label="Overdue" value={metrics.overdue} accent={metrics.overdue > 0 ? "red" : undefined} />
        <MetricCard label="Completed" value={metrics.done} />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search client, partner..."
          className="flex-1 min-w-[200px] min-h-[40px] rounded-xl border-2 border-gray-200 px-4 text-sm focus:border-gold focus:outline-none"
        />
        <button
          onClick={() => setOverdueOnly((v) => !v)}
          className={`min-h-[40px] rounded-xl border-2 px-3 text-sm font-medium transition-colors ${
            overdueOnly ? "border-red-400 bg-red-50 text-red-700" : "border-gray-200 text-charcoal/60 hover:border-gold/40"
          }`}
        >
          {overdueOnly ? "✓ Overdue only" : "Overdue only"}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 pb-4">
        {COLUMNS.map((col) => {
          const list = getColumnCases(col.id);
          const isDropTarget = dragOverCol === col.id;
          const draggedCase = dragItem ? cases.find((c) => c.id === dragItem) : null;
          const canDrop = draggedCase ? (MANUAL_TRANSITIONS[draggedCase.status] || []).includes(col.id) : false;
          return (
            <div
              key={col.id}
              className="min-w-0"
              onDragOver={(e) => { if (canDrop) { e.preventDefault(); setDragOverCol(col.id); } }}
              onDragLeave={() => setDragOverCol((c) => (c === col.id ? null : c))}
              onDrop={() => { if (dragItem && canDrop) moveCase(dragItem, col.id); setDragItem(null); setDragOverCol(null); }}
            >
              <div className={`rounded-t-xl px-2 py-2 flex items-center justify-between gap-1 ${col.color}`}>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold text-white truncate block">{col.label}</span>
                  <p className="text-[9px] text-white/60 mt-0.5 truncate">{col.hint}</p>
                </div>
                <span className="text-[10px] font-semibold text-white bg-white/15 rounded-full px-1.5 py-0.5 flex-shrink-0">{list.length}</span>
              </div>
              <div className={`rounded-b-xl min-h-[400px] p-1.5 space-y-1.5 transition-colors ${
                isDropTarget && canDrop ? "bg-gold/10 ring-2 ring-gold/40" : "bg-gray-50"
              }`}>
                {list.map((c) => {
                  const sla = slaState(c.sla_deadline);
                  const draggable = c.status === "pending" || c.status === "in_review";
                  return (
                    <Link
                      key={c.id}
                      href={`/attorney/review/${c.id}`}
                      draggable={draggable}
                      onDragStart={() => draggable && setDragItem(c.id)}
                      onDragEnd={() => { setDragItem(null); setDragOverCol(null); }}
                      className={`block rounded-lg bg-white border p-2 shadow-sm hover:shadow-md hover:border-gold/40 transition-all ${
                        sla.tone === "red" ? "border-l-4 border-l-red-400 border-red-200" :
                        sla.tone === "orange" ? "border-l-4 border-l-orange-400 border-orange-200" :
                        "border-gray-200"
                      } ${dragItem === c.id ? "opacity-50" : ""} ${draggable ? "cursor-grab" : "cursor-pointer"}`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <p className="text-xs font-semibold text-navy truncate leading-tight">{c.client_name || "Client"}</p>
                        <span className="inline-flex items-center rounded-full bg-navy/5 px-1.5 py-0.5 text-[9px] font-medium text-navy flex-shrink-0">
                          {c.product_type === "trust" ? "Trust" : "Will"}
                        </span>
                      </div>
                      <p className="text-[10px] text-charcoal/50 mt-1 truncate">{c.partner_company || <span className="italic text-charcoal/30">Direct client</span>}</p>
                      <div className="mt-1.5 flex items-center justify-between gap-1">
                        <span className={`text-[10px] font-medium truncate ${
                          sla.tone === "red" ? "text-red-600" :
                          sla.tone === "orange" ? "text-orange-600" : "text-charcoal/50"
                        }`}>
                          {sla.tone === "red" && "⚠ "}{sla.label}
                        </span>
                        <span className="text-[10px] font-medium text-gold flex-shrink-0">Open →</span>
                      </div>
                    </Link>
                  );
                })}
                {list.length === 0 && (
                  <div className="text-xs text-charcoal/40 text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
                    Empty
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetricCard({ label, value, accent }: { label: string; value: number; accent?: "red" }) {
  return (
    <div className={`rounded-xl border bg-white p-3 ${accent === "red" ? "border-red-300" : "border-gray-200"}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-charcoal/50">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent === "red" ? "text-red-600" : "text-navy"}`}>{value}</p>
    </div>
  );
}
