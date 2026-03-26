"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface ClientDetail { id: string; created_at: string; profiles: { full_name: string; email: string; phone: string } | null }
interface Order { id: string; product_type: string; status: string; amount_total: number; partner_cut: number; attorney_review_requested: boolean; complexity_flag: boolean; complexity_flag_reason: string; created_at: string }
interface Doc { id: string; document_type: string; status: string; created_at: string }
interface Note { id: string; note: string; created_at: string }

export default function ClientDetailPage() {
  const params = useParams();
  const clientId = params["client-id"] as string;
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [tab, setTab] = useState("overview");
  const [activity, setActivity] = useState<Array<{ action: string; created_at: string }>>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: c } = await supabase.from("clients").select("id, created_at, profiles(full_name, email, phone)").eq("id", clientId).single();
      if (c) setClient(c as unknown as ClientDetail);

      const { data: o } = await supabase.from("orders").select("*").eq("client_id", clientId).order("created_at", { ascending: false });
      setOrders((o || []) as Order[]);

      const { data: d } = await supabase.from("documents").select("id, document_type, status, created_at").eq("client_id", clientId);
      setDocs((d || []) as Doc[]);

      const { data: n } = await supabase.from("client_notes").select("id, note, created_at").eq("client_id", clientId).order("created_at", { ascending: false });
      setNotes((n || []) as Note[]);

      const { data: a } = await supabase.from("audit_log").select("action, created_at").eq("resource_id", clientId).order("created_at", { ascending: false }).limit(20);
      setActivity(a || []);
    }
    load();
  }, [clientId]);

  async function addNote() {
    if (!newNote.trim()) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: partner } = await supabase.from("partners").select("id").eq("profile_id", user.id).single();
    if (!partner) return;

    await fetch("/api/partner/clients", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId, partnerId: partner.id, note: newNote }) });
    setNotes((prev) => [{ id: Date.now().toString(), note: newNote, created_at: new Date().toISOString() }, ...prev]);
    setNewNote("");
  }

  if (!client) return <div className="py-20 text-center text-charcoal/50">Loading...</div>;

  const order = orders[0];
  const name = client.profiles?.full_name || client.profiles?.email || "Client";

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "documents", label: "Documents" },
    { id: "activity", label: "Activity" },
    { id: "notes", label: "Notes" },
  ];

  return (
    <div className="max-w-4xl">
      <a href="/pro/clients" className="text-sm text-navy/60 hover:text-navy">← Clients</a>

      {/* Header */}
      <div className="mt-4 rounded-xl bg-white border border-gray-200 p-6">
        <h1 className="text-xl font-bold text-navy">{name}</h1>
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-charcoal/60">
          <span>{client.profiles?.email}</span>
          {client.profiles?.phone && <span>{client.profiles.phone}</span>}
        </div>
        <div className="mt-3 flex gap-2">
          {order && <span className="rounded-full bg-navy/10 px-3 py-1 text-xs font-medium text-navy">{order.product_type === "trust" ? "Trust Package" : "Will Package"}</span>}
          {order && <span className={`rounded-full px-3 py-1 text-xs font-medium ${order.status === "delivered" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>{order.status}</span>}
        </div>
      </div>

      {/* Complexity flag */}
      {order?.complexity_flag && (
        <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-4">
          <p className="text-sm font-semibold text-amber-800">⚠ Complexity Flag</p>
          <p className="text-sm text-amber-700 mt-1">This client&apos;s situation was flagged: {order.complexity_flag_reason}</p>
          <p className="text-xs text-amber-600 mt-1">Attorney review was {order.attorney_review_requested ? "selected" : "declined with acknowledgment"}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="mt-6 flex gap-1 border-b border-gray-200">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? "border-gold text-navy" : "border-transparent text-charcoal/50 hover:text-charcoal"}`}>{t.label}</button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "overview" && (
          <div className="space-y-4">
            {order && (
              <div className="rounded-xl bg-white border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-navy">Order Details</h3>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-charcoal/50">Amount</span><p className="font-medium text-navy">${order.amount_total / 100}</p></div>
                  <div><span className="text-charcoal/50">Your Earnings</span><p className="font-medium text-green-600">${(order.partner_cut || 0) / 100}</p></div>
                  <div><span className="text-charcoal/50">Date</span><p className="text-charcoal/70">{new Date(order.created_at).toLocaleDateString()}</p></div>
                  <div><span className="text-charcoal/50">Attorney Review</span><p className="text-charcoal/70">{order.attorney_review_requested ? "Yes" : "No"}</p></div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "documents" && (
          <div className="space-y-3">
            {docs.length === 0 ? <p className="text-sm text-charcoal/50">No documents yet.</p> : docs.map((d) => (
              <div key={d.id} className="rounded-xl bg-white border border-gray-200 p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-navy">{d.document_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</p>
                  <p className="text-xs text-charcoal/50 mt-0.5">{new Date(d.created_at).toLocaleDateString()}</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${d.status === "delivered" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>{d.status}</span>
              </div>
            ))}
          </div>
        )}

        {tab === "activity" && (
          <div className="space-y-3">
            {activity.length === 0 ? <p className="text-sm text-charcoal/50">No activity recorded.</p> : activity.map((a, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-charcoal/70">{a.action.replace(/\./g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</span>
                <span className="text-xs text-charcoal/40">{new Date(a.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}

        {tab === "notes" && (
          <div>
            <div className="flex gap-2">
              <input type="text" value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Add a note..." className="flex-1 min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none" />
              <button onClick={addNote} disabled={!newNote.trim()} className="rounded-full bg-gold px-5 py-2 text-sm font-semibold text-white hover:bg-gold/90 disabled:opacity-50">Add Note</button>
            </div>
            <div className="mt-4 space-y-3">
              {notes.map((n) => (
                <div key={n.id} className="rounded-xl bg-white border border-gray-200 p-4">
                  <p className="text-sm text-charcoal/80">{n.note}</p>
                  <p className="text-xs text-charcoal/40 mt-2">{new Date(n.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
