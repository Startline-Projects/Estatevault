"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { listTrustees, addTrustee, deleteTrustee, type TrusteePlaintext } from "@/lib/repos/trusteeRepo";
import { useVaultLock } from "@/hooks/useVaultLock";

const REL_OPTIONS = ["Spouse/Partner", "Adult Child", "Sibling", "Parent", "Attorney", "Friend", "Other"];

export default function TrusteesPage() {
  const { isLocked, state } = useVaultLock();
  const router = useRouter();
  const [trustees, setTrustees] = useState<TrusteePlaintext[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [relationship, setRelationship] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [justAdded, setJustAdded] = useState(false);

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

  useEffect(() => {
    if (isLocked) router.replace("/dashboard/vault?next=/dashboard/vault/trustees");
  }, [isLocked, router]);

  async function handleAdd() {
    if (!name.trim() || !email.trim() || !relationship) return;
    if (trustees.length >= 2) { setError("Maximum 2 trustees allowed"); return; }
    setSaving(true);
    setError("");

    try {
      await addTrustee({ name: name.trim(), email: email.trim(), relationship });
      setName(""); setEmail(""); setRelationship("");
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
    try {
      await deleteTrustee(id);
      setJustAdded(false);
      await loadTrustees();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (isLocked) {
    return <div className="py-20 text-center text-charcoal/50">{state === "uninitialized" ? "Loading..." : "Redirecting to unlock..."}</div>;
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
                {t.status === "pending" && (
                  <p className="text-xs text-amber-600 mt-1">Awaiting email confirmation from trustee</p>
                )}
              </div>
              <button onClick={() => handleRemove(t.id)} className="text-xs text-red-500 hover:text-red-700 ml-4 shrink-0">Remove</button>
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
            <button onClick={handleAdd} disabled={saving || !name.trim() || !email.trim() || !relationship}
              className="w-full min-h-[44px] rounded-full bg-gold py-3 text-sm font-semibold text-white hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? "Sending invite..." : "Add Trustee & Send Invite"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
