"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface Trustee {
  id: string;
  trustee_name: string;
  trustee_email: string;
  trustee_relationship: string;
}

const REL_OPTIONS = ["Spouse/Partner", "Adult Child", "Sibling", "Parent", "Attorney", "Friend", "Other"];

export default function TrusteesPage() {
  const [trustees, setTrustees] = useState<Trustee[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [relationship, setRelationship] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadTrustees() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const res = await fetch("/api/vault/trustees");
    const data = await res.json();
    setTrustees(data.trustees || []);
    setLoading(false);
  }

  useEffect(() => { loadTrustees(); }, []);

  async function handleAdd() {
    if (!name.trim() || !email.trim() || !relationship) return;
    if (trustees.length >= 2) { setError("Maximum 2 trustees allowed"); return; }
    setSaving(true);
    setError("");

    const res = await fetch("/api/vault/trustees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trustee_name: name, trustee_email: email, trustee_relationship: relationship }),
    });

    if (!res.ok) { const d = await res.json(); setError(d.error || "Failed to add trustee"); setSaving(false); return; }
    setName(""); setEmail(""); setRelationship("");
    await loadTrustees();
    setSaving(false);
  }

  async function handleRemove(id: string) {
    await fetch(`/api/vault/trustees?id=${id}`, { method: "DELETE" });
    await loadTrustees();
  }

  if (loading) return <div className="py-20 text-center text-charcoal/50">Loading...</div>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-navy">Emergency Vault Access</h1>
      <p className="mt-2 text-sm text-charcoal/60 leading-relaxed">
        In the event of your passing or incapacity, your designated Vault Trustee can request access to your vault after a 72-hour review period and identity verification.
      </p>

      {/* Existing trustees */}
      {trustees.length > 0 && (
        <div className="mt-6 space-y-3">
          {trustees.map((t) => (
            <div key={t.id} className="rounded-xl bg-white border border-gray-200 p-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-navy">{t.trustee_name}</p>
                <p className="text-xs text-charcoal/50">{t.trustee_email} · {t.trustee_relationship}</p>
              </div>
              <button onClick={() => handleRemove(t.id)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
            </div>
          ))}
        </div>
      )}

      {/* Add trustee form */}
      {trustees.length < 2 && (
        <div className="mt-8 rounded-xl bg-white border border-gray-200 p-6">
          <h2 className="text-base font-bold text-navy">Add Trustee</h2>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-navy mb-1">Full name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none" placeholder="Full name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full min-h-[44px] rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-gold focus:outline-none" placeholder="email@example.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy mb-1">Relationship</label>
              <div className="flex flex-wrap gap-2">
                {REL_OPTIONS.map((opt) => (
                  <button key={opt} type="button" onClick={() => setRelationship(opt)}
                    className={`rounded-lg border-2 px-4 py-2 text-sm ${relationship === opt ? "border-gold bg-gold/10 text-navy" : "border-gray-200 text-charcoal/70 hover:border-gold/40"}`}>{opt}</button>
                ))}
              </div>
            </div>
            <button onClick={handleAdd} disabled={saving || !name.trim() || !email.trim() || !relationship}
              className="w-full min-h-[44px] rounded-full bg-gold py-3 text-sm font-semibold text-white hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? "Adding..." : "Add Trustee"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
