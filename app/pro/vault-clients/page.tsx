"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface VaultClient {
  id: string;
  profile_id: string;
  created_at: string;
  vault_subscription_status: string | null;
  profiles: { full_name: string | null; email: string } | null;
}

export default function VaultClientsPage() {
  const [clients, setClients] = useState<VaultClient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: partner } = await supabase
        .from("partners")
        .select("id")
        .eq("profile_id", user.id)
        .single();
      if (!partner) return;

      const { data } = await supabase
        .from("clients")
        .select("id, profile_id, created_at, vault_subscription_status, profiles(full_name, email)")
        .eq("partner_id", partner.id)
        .order("created_at", { ascending: false });

      setClients((data as unknown as VaultClient[]) || []);
      setLoading(false);
    }
    load();
  }, []);

  function statusBadge(status: string | null) {
    if (status === "active") return <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">Active</span>;
    if (status === "past_due") return <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">Past Due</span>;
    if (status === "cancelled") return <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">Cancelled</span>;
    return <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">Pending</span>;
  }

  if (loading) {
    return (
      <div className="space-y-3 max-w-5xl">
        {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-navy">Vault Clients</h1>
          <span className="rounded-full bg-navy/10 px-2.5 py-0.5 text-xs font-semibold text-navy">{clients.length}</span>
        </div>
        <Link href="/pro/vault-clients/new" className="rounded-full bg-gold px-5 py-2 text-sm font-semibold text-white hover:bg-gold/90 transition-colors">
          + Add Vault Client
        </Link>
      </div>

      <p className="mt-2 text-sm text-charcoal/60">Create vaults for your clients. You pay the $99/year subscription — they get secure document storage and a PIN-protected vault.</p>

      {clients.length === 0 ? (
        <div className="mt-16 text-center">
          <span className="text-4xl">🔐</span>
          <p className="mt-4 text-sm text-charcoal/50">No vault clients yet</p>
          <p className="text-xs text-charcoal/60 mt-1">Add your first client to get started.</p>
          <Link href="/pro/vault-clients/new" className="mt-6 inline-block rounded-full bg-gold px-6 py-2.5 text-sm font-semibold text-white hover:bg-gold/90">
            Add Vault Client →
          </Link>
        </div>
      ) : (
        <div className="mt-6 rounded-xl bg-white border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy">Client</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy">Added</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const name = c.profiles?.full_name || "—";
                const email = c.profiles?.email || "—";
                return (
                  <tr key={c.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-navy">{name}</td>
                    <td className="px-4 py-3 text-charcoal/70">{email}</td>
                    <td className="px-4 py-3">{statusBadge(c.vault_subscription_status)}</td>
                    <td className="px-4 py-3 text-xs text-charcoal/50">{new Date(c.created_at).toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
