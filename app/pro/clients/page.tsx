"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface ClientRow { id: string; profile_id: string; created_at: string; profiles: { full_name: string; email: string } | null; orders: Array<{ product_type: string; status: string; partner_cut: number }> }

export default function ProClientsPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [certified, setCertified] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalTab, setModalTab] = useState<"start" | "invite">("start");
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", message: "" });
  const [sending, setSending] = useState(false);
  const [partnerId, setPartnerId] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: partner } = await supabase.from("partners").select("id, certification_completed").eq("profile_id", user.id).single();
      if (!partner) return;
      setPartnerId(partner.id);
      setCertified(partner.certification_completed || false);

      const { data } = await supabase.from("clients").select("id, profile_id, created_at, profiles(full_name, email)").eq("partner_id", partner.id).order("created_at", { ascending: false });

      if (data) {
        const withOrders = await Promise.all(data.map(async (c) => {
          const { data: orders } = await supabase.from("orders").select("product_type, status, partner_cut").eq("client_id", c.id);
          return { ...c, orders: orders || [] } as unknown as ClientRow;
        }));
        setClients(withOrders);
      }
      setLoading(false);
    }
    load();
  }, []);

  function getStatus(orders: ClientRow["orders"]): string {
    if (!orders.length) return "in_progress";
    const latest = orders[0];
    return latest.status;
  }

  function statusBadge(status: string) {
    const map: Record<string, { label: string; cls: string }> = {
      pending: { label: "In Progress", cls: "bg-blue-100 text-blue-700" },
      in_progress: { label: "In Progress", cls: "bg-blue-100 text-blue-700" },
      paid: { label: "Generating", cls: "bg-purple-100 text-purple-700" },
      generating: { label: "Generating", cls: "bg-purple-100 text-purple-700" },
      review: { label: "Under Review", cls: "bg-orange-100 text-orange-700" },
      delivered: { label: "Delivered", cls: "bg-green-100 text-green-700" },
    };
    const s = map[status] || { label: status, cls: "bg-gray-100 text-gray-700" };
    return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>;
  }

  const filtered = clients.filter((c) => {
    const name = (c.profiles?.full_name || c.profiles?.email || "").toLowerCase();
    if (search && !name.includes(search.toLowerCase())) return false;
    if (filter !== "all") {
      const status = getStatus(c.orders);
      if (filter === "delivered" && status !== "delivered") return false;
      if (filter === "pending" && !["pending", "in_progress"].includes(status)) return false;
      if (filter === "review" && status !== "review") return false;
    }
    return true;
  });

  async function handleStartSession() {
    if (!form.firstName || !form.email) return;
    setSending(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Create auth user for client
    const res = await fetch("/api/partner/clients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, partnerId, action: "start" }) });
    if (res.ok) {
      const data = await res.json();
      window.open(`/quiz?partner=${partnerId}&client=${data.clientId}`, "_blank");
      setShowModal(false);
      setForm({ firstName: "", lastName: "", email: "", phone: "", message: "" });
    }
    setSending(false);
  }

  async function handleSendInvite() {
    if (!form.firstName || !form.email) return;
    setSending(true);
    await fetch("/api/partner/clients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, partnerId, action: "invite" }) });
    setShowModal(false);
    setForm({ firstName: "", lastName: "", email: "", phone: "", message: "" });
    setSending(false);
  }

  if (loading) return <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />)}</div>;

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-navy">Clients</h1>
          <span className="rounded-full bg-navy/10 px-2.5 py-0.5 text-xs font-semibold text-navy">{clients.length}</span>
        </div>
        <div className="flex gap-2">
          {certified ? (
            <>
              <button onClick={() => { setShowModal(true); setModalTab("start"); }} className="rounded-full bg-gold px-5 py-2 text-sm font-semibold text-white hover:bg-gold/90">+ New Client Session</button>
              <button onClick={() => { setShowModal(true); setModalTab("invite"); }} className="rounded-full border border-navy px-5 py-2 text-sm font-medium text-navy hover:bg-navy hover:text-white transition-colors">Send Invite Link</button>
            </>
          ) : (
            <button disabled className="rounded-full bg-gray-200 px-5 py-2 text-sm font-semibold text-gray-400 cursor-not-allowed">🔒 Complete Certification</button>
          )}
        </div>
      </div>

      {/* Search/filter */}
      <div className="mt-6 flex gap-3">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email" className="flex-1 min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none" />
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none">
          <option value="all">All</option>
          <option value="pending">In Progress</option>
          <option value="review">Under Review</option>
          <option value="delivered">Delivered</option>
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="mt-16 text-center">
          <span className="text-4xl">👥</span>
          <p className="mt-4 text-sm text-charcoal/50">No clients yet</p>
          <p className="text-xs text-charcoal/60 mt-1">Create your first client session or send an invite link to get started.</p>
        </div>
      ) : (
        <div className="mt-4 rounded-xl bg-white border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-navy">Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-navy">Package</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-navy">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-navy">Date</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-navy">Earnings</th>
              <th className="px-4 py-3" />
            </tr></thead>
            <tbody>
              {filtered.map((c) => {
                const name = c.profiles?.full_name || c.profiles?.email || "Unknown";
                const initials = name.split(" ").map((w: string) => w[0]).join("").slice(0, 2);
                const order = c.orders[0];
                const status = getStatus(c.orders);
                return (
                  <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3"><span className="font-medium text-navy">{initials}.</span></td>
                    <td className="px-4 py-3">{order ? <span className="rounded-full bg-navy/10 px-2 py-0.5 text-xs text-navy">{order.product_type === "trust" ? "Trust" : "Will"}</span> : "-"}</td>
                    <td className="px-4 py-3">{statusBadge(status)}</td>
                    <td className="px-4 py-3 text-charcoal/50 text-xs">{new Date(c.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-charcoal/70">{order?.partner_cut ? `$${order.partner_cut / 100}` : "-"}</td>
                    <td className="px-4 py-3"><Link href={`/pro/clients/${c.id}`} className="text-xs text-gold hover:text-gold/80">View</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* New client modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-t-2xl md:rounded-2xl p-6 shadow-xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-navy">New Client</h2>
              <button onClick={() => setShowModal(false)} className="text-charcoal/60 hover:text-charcoal text-xl">×</button>
            </div>
            <div className="flex gap-2 mb-6">
              <button onClick={() => setModalTab("start")} className={`rounded-full px-4 py-1.5 text-sm font-medium ${modalTab === "start" ? "bg-navy text-white" : "bg-gray-100 text-charcoal/60"}`}>Start With Client Now</button>
              <button onClick={() => setModalTab("invite")} className={`rounded-full px-4 py-1.5 text-sm font-medium ${modalTab === "invite" ? "bg-navy text-white" : "bg-gray-100 text-charcoal/60"}`}>Send Invite Link</button>
            </div>
            <div className="space-y-4">
              <input type="text" value={form.firstName} onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))} placeholder="Client first name" className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none" />
              {modalTab === "start" && <input type="text" value={form.lastName} onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))} placeholder="Client last name" className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none" />}
              <input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="Client email" className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none" />
              {modalTab === "invite" && <textarea value={form.message} onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))} placeholder="Add a personal note to your client..." rows={3} className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none resize-none" />}
              <button onClick={modalTab === "start" ? handleStartSession : handleSendInvite} disabled={sending || !form.firstName || !form.email} className="w-full min-h-[44px] rounded-full bg-gold py-3 text-sm font-semibold text-white hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed">
                {sending ? "Processing..." : modalTab === "start" ? "Start Session →" : "Send Invitation →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
