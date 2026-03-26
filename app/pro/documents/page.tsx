"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface DocumentRow {
  id: string;
  product_type: string;
  status: string;
  created_at: string;
  client_name: string;
}

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "generating", label: "Generating" },
  { value: "review", label: "Under Review" },
  { value: "delivered", label: "Delivered" },
];

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "Pending", cls: "bg-yellow-100 text-yellow-700" },
    paid: { label: "Paid", cls: "bg-blue-100 text-blue-700" },
    generating: { label: "Generating", cls: "bg-purple-100 text-purple-700" },
    review: { label: "Under Review", cls: "bg-orange-100 text-orange-700" },
    delivered: { label: "Delivered", cls: "bg-green-100 text-green-700" },
  };
  const s = map[status] || { label: status, cls: "bg-gray-100 text-gray-700" };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

export default function ProDocumentsPage() {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: partner } = await supabase
        .from("partners")
        .select("id")
        .eq("profile_id", user.id)
        .single();
      if (!partner) return;

      const { data: orders } = await supabase
        .from("orders")
        .select("id, product_type, status, created_at, client_id")
        .eq("partner_id", partner.id)
        .order("created_at", { ascending: false });

      if (!orders || orders.length === 0) {
        setDocuments([]);
        setLoading(false);
        return;
      }

      const clientIds = Array.from(new Set(orders.map((o) => o.client_id)));
      const { data: clients } = await supabase
        .from("clients")
        .select("id, profiles(full_name, email)")
        .in("id", clientIds);

      const clientMap: Record<string, string> = {};
      if (clients) {
        for (const c of clients) {
          const profile = c.profiles as unknown as { full_name: string; email: string } | null;
          clientMap[c.id] = profile?.full_name || profile?.email || "Unknown";
        }
      }

      const rows: DocumentRow[] = orders.map((o) => ({
        id: o.id,
        product_type: o.product_type,
        status: o.status,
        created_at: o.created_at,
        client_name: clientMap[o.client_id] || "Unknown",
      }));

      setDocuments(rows);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = documents.filter((d) => {
    if (search && !d.client_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "all" && d.status !== statusFilter) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="max-w-5xl space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-navy">Documents</h1>
      <p className="mt-1 text-sm text-charcoal/60">
        All documents across your client base.
      </p>

      {/* Search and filter */}
      <div className="mt-6 flex gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by client name..."
          className="flex-1 min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table or empty state */}
      {filtered.length === 0 ? (
        <div className="mt-16 text-center">
          <span className="text-4xl">📄</span>
          <p className="mt-4 text-sm text-charcoal/50">No documents found</p>
          <p className="text-xs text-charcoal/40 mt-1">
            Documents will appear here as your clients complete their estate planning packages.
          </p>
        </div>
      ) : (
        <div className="mt-4 rounded-xl bg-white border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy">
                  Client
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy">
                  Document Type
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr
                  key={d.id}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-4 py-3 font-medium text-navy">
                    {d.client_name}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-navy/10 px-2.5 py-0.5 text-xs font-medium text-navy">
                      {d.product_type === "trust" ? "Trust Package" : "Will Package"}
                    </span>
                  </td>
                  <td className="px-4 py-3">{statusBadge(d.status)}</td>
                  <td className="px-4 py-3 text-charcoal/50 text-xs">
                    {new Date(d.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
