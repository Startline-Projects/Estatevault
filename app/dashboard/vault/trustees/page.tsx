"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { listTrustees, addTrustee, deleteTrustee, FULL_SCOPE, type TrusteePlaintext, type AccessScope } from "@/lib/repos/trusteeRepo";
import { useVaultLock } from "@/hooks/useVaultLock";

const REL_OPTIONS = ["Spouse/Partner", "Adult Child", "Sibling", "Parent", "Attorney", "Friend", "Other"];

const CATEGORY_OPTIONS: Array<{ key: string; label: string }> = [
  { key: "estate_document", label: "Estate Documents" },
  { key: "financial_account", label: "Financial Accounts" },
  { key: "insurance", label: "Insurance Policies" },
  { key: "digital_account", label: "Digital Accounts" },
  { key: "physical_location", label: "Physical Locations" },
  { key: "contact", label: "Important Contacts" },
  { key: "business", label: "Business Interests" },
  { key: "final_wishes", label: "Final Wishes" },
];

function scopeSummary(s: AccessScope): string {
  const parts: string[] = [];
  if (s.farewell) parts.push("Farewell");
  if (s.documents) parts.push("Documents");
  parts.push(...s.categories.map((c) => CATEGORY_OPTIONS.find((o) => o.key === c)?.label ?? c));
  return parts.length ? parts.join(" · ") : "No access granted";
}

export default function TrusteesPage() {
  const { isLocked, state } = useVaultLock();
  const [trustees, setTrustees] = useState<TrusteePlaintext[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [relationship, setRelationship] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [justAdded, setJustAdded] = useState(false);
  const [scope, setScope] = useState<AccessScope>({ ...FULL_SCOPE });

  function toggleCategory(key: string) {
    setScope((p) => ({
      ...p,
      categories: p.categories.includes(key) ? p.categories.filter((c) => c !== key) : [...p.categories, key],
    }));
  }
  const scopeEmpty = scope.categories.length === 0 && !scope.documents && !scope.farewell;

  const loadTrustees = useCallback(async () => {
    if (isLocked) { setLoading(false); return; }
    try {
      const list = await listTrustees();
      setTrustees(list);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [isLocked]);

  useEffect(() => { loadTrustees(); }, [loadTrustees]);

  async function handleAdd() {
    if (!name.trim() || !email.trim() || !relationship) return;
    if (trustees.length >= 2) { setError("Maximum 2 trustees allowed"); return; }
    if (scopeEmpty) { setError("Grant at least one access scope"); return; }
    setSaving(true);
    setError("");

    try {
      await addTrustee({ name: name.trim(), email: email.trim(), relationship, accessScope: scope });
      setName(""); setEmail(""); setRelationship(""); setScope({ ...FULL_SCOPE });
      setJustAdded(true);
      await loadTrustees();
    } catch (e) {
      const err = e as Error & { action?: string };
      if (err.action === "setup_shamir") {
        window.location.href = "/dashboard/vault/trustees/init";
        return;
      }
      setError(err.message || "Failed to add trustee");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: string) {
    if (removingId) return;
    setRemovingId(id);
    setError("");
    try {
      await deleteTrustee(id);
      setTrustees((prev) => prev.filter((t) => t.id !== id));
      setJustAdded(false);
    } catch (e) {
      setError((e as Error).message || "Failed to remove trustee");
    } finally {
      setRemovingId(null);
    }
  }

  if (isLocked) {
    return <div className="py-20 text-center text-charcoal/50">{state === "uninitialized" ? "Loading..." : "Unlock vault to manage emergency access."}</div>;
  }
  if (loading) return <div className="py-20 text-center text-charcoal/50">Loading...</div>;

  return (
    <div className="max-w-2xl">
      <Link href="/dashboard/vault" className="inline-block text-sm text-navy hover:text-gold transition-colors mb-4">&larr; Back to Vault</Link>
      <h1 className="text-2xl font-bold text-navy">Emergency Vault Access</h1>
      <p className="mt-2 text-sm text-charcoal/60 leading-relaxed">
        In the event of your passing or incapacity, your designated Vault Trustee can request access to your vault after a 72-hour review period and identity verification.
      </p>

      {justAdded && (
        <div className="mt-4 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          Confirmation email sent. Trustee must click the link in their email to accept the role.
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {trustees.length > 0 && (
        <div className="mt-6 space-y-3">
          {trustees.map((t) => (
            <div key={t.id} className="rounded-xl bg-white border border-gray-200 p-5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-navy">{t.name}</p>
                  {t.status === "pending" ? (
                    <span className="rounded-full bg-amber-100 text-amber-700 text-[11px] font-semibold px-2 py-0.5">Pending</span>
                  ) : (
                    <span className="rounded-full bg-green-100 text-green-700 text-[11px] font-semibold px-2 py-0.5">Confirmed</span>
                  )}
                  {t.encrypted && (
                    <span className="rounded-full bg-[#1C3557]/10 text-[#1C3557] text-[10px] font-semibold px-2 py-0.5" title="End-to-end encrypted">E2EE</span>
                  )}
                </div>
                <p className="text-xs text-charcoal/50 mt-0.5">{t.email} · {t.relationship}</p>
                <p className="text-[11px] text-charcoal/60 mt-1"><span className="font-medium">Access:</span> {scopeSummary(t.accessScope)}</p>
                {t.status === "pending" && (
                  <p className="text-xs text-amber-600 mt-1">Awaiting email confirmation from trustee</p>
                )}
              </div>
              <button
                onClick={() => handleRemove(t.id)}
                disabled={removingId === t.id}
                className="inline-flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 ml-4 shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {removingId === t.id && (
                  <span className="w-3 h-3 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
                )}
                {removingId === t.id ? "Removing..." : "Remove"}
              </button>
            </div>
          ))}
        </div>
      )}

      {trustees.length < 2 && (
        <div className="mt-8 rounded-xl bg-white border border-gray-200 p-6">
          <h2 className="text-base font-bold text-navy">Add Trustee</h2>
          <p className="text-xs text-charcoal/50 mt-1">A confirmation email will be sent to the trustee. They must accept before the role is active.</p>
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
            <div>
              <label className="block text-sm font-medium text-navy mb-1">Access Scope</label>
              <p className="text-xs text-charcoal/50 mb-2">Pick what this trustee can see after emergency unlock.</p>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-charcoal cursor-pointer">
                  <input type="checkbox" checked={scope.farewell} onChange={(e) => setScope((p) => ({ ...p, farewell: e.target.checked }))} className="rounded border-gray-300 text-gold focus:ring-gold" />
                  Farewell Messages
                </label>
                <label className="flex items-center gap-2 text-sm text-charcoal cursor-pointer">
                  <input type="checkbox" checked={scope.documents} onChange={(e) => setScope((p) => ({ ...p, documents: e.target.checked }))} className="rounded border-gray-300 text-gold focus:ring-gold" />
                  Uploaded Documents
                </label>
              </div>
              <p className="text-xs font-medium text-charcoal/70 mt-3 mb-1">Vault categories</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_OPTIONS.map((opt) => {
                  const on = scope.categories.includes(opt.key);
                  return (
                    <button key={opt.key} type="button" onClick={() => toggleCategory(opt.key)}
                      className={`rounded-lg border-2 px-3 py-1.5 text-xs ${on ? "border-gold bg-gold/10 text-navy" : "border-gray-200 text-charcoal/70 hover:border-gold/40"}`}>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-3 mt-2">
                <button type="button" onClick={() => setScope({ ...FULL_SCOPE })} className="text-xs text-navy/60 hover:text-navy underline">Select all</button>
                <button type="button" onClick={() => setScope({ categories: [], documents: false, farewell: false })} className="text-xs text-navy/60 hover:text-navy underline">Clear all</button>
              </div>
            </div>
            <button onClick={handleAdd} disabled={saving || !name.trim() || !email.trim() || !relationship || scopeEmpty}
              className="w-full min-h-[44px] rounded-full bg-gold py-3 text-sm font-semibold text-white hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? "Sending invite..." : "Add Trustee & Send Invite"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
