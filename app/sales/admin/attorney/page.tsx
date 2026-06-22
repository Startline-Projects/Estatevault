"use client";

import { useEffect, useState } from "react";
import { getMyProfile } from "@/lib/api-client/profile";
import {
  getAttorneyReviewFee,
  setAttorneyReviewFee,
  getAttorneyCommissions,
  updateAttorneyCommission,
  type AttorneyCommissionRow,
} from "@/lib/api-client/sales";
import { ATTORNEY_REVIEW_FEE_RANGE } from "@/lib/orders/pricing";

const MIN_FEE = ATTORNEY_REVIEW_FEE_RANGE.min / 100; // dollars
const MAX_FEE = ATTORNEY_REVIEW_FEE_RANGE.max / 100;

export default function AttorneySettingsPage() {
  const [authState, setAuthState] = useState<"loading" | "denied" | "ok">("loading");

  // Review fee (dollars)
  const [feeInput, setFeeInput] = useState<number>(MIN_FEE);
  const [feeSaving, setFeeSaving] = useState(false);
  const [feeSaved, setFeeSaved] = useState(false);
  const [feeError, setFeeError] = useState("");

  // Attorney commissions
  const [attorneys, setAttorneys] = useState<AttorneyCommissionRow[]>([]);
  // Per-row percent input + save state, keyed by attorney id.
  const [pctInput, setPctInput] = useState<Record<string, number>>({});
  const [rowSaving, setRowSaving] = useState<Record<string, boolean>>({});
  const [rowSaved, setRowSaved] = useState<Record<string, boolean>>({});
  const [rowError, setRowError] = useState<Record<string, string>>({});

  useEffect(() => {
    async function load() {
      const { data: prof } = await getMyProfile();
      if (prof?.profile?.user_type !== "admin") {
        setAuthState("denied");
        return;
      }
      setAuthState("ok");

      const [{ data: feeData }, { data: comData }] = await Promise.all([
        getAttorneyReviewFee(),
        getAttorneyCommissions(),
      ]);
      if (feeData) setFeeInput(feeData.fee / 100);
      if (comData?.attorneys) {
        setAttorneys(comData.attorneys);
        setPctInput(
          Object.fromEntries(comData.attorneys.map((a) => [a.id, +(a.commission_rate * 100).toFixed(2)])),
        );
      }
    }
    load();
  }, []);

  async function saveFee() {
    setFeeError("");
    const dollars = Number(feeInput);
    if (!Number.isFinite(dollars) || dollars < MIN_FEE || dollars > MAX_FEE) {
      setFeeError(`Fee must be between $${MIN_FEE} and $${MAX_FEE}.`);
      return;
    }
    setFeeSaving(true);
    const { error } = await setAttorneyReviewFee(Math.round(dollars * 100));
    setFeeSaving(false);
    if (error) {
      setFeeError("Failed to save. Try again.");
      return;
    }
    setFeeSaved(true);
    setTimeout(() => setFeeSaved(false), 2500);
  }

  async function saveRow(id: string) {
    setRowError((s) => ({ ...s, [id]: "" }));
    const pct = Number(pctInput[id]);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      setRowError((s) => ({ ...s, [id]: "0–100 only" }));
      return;
    }
    setRowSaving((s) => ({ ...s, [id]: true }));
    const { error } = await updateAttorneyCommission(id, pct);
    setRowSaving((s) => ({ ...s, [id]: false }));
    if (error) {
      setRowError((s) => ({ ...s, [id]: "Failed" }));
      return;
    }
    setAttorneys((list) => list.map((a) => (a.id === id ? { ...a, commission_rate: pct / 100 } : a)));
    setRowSaved((s) => ({ ...s, [id]: true }));
    setTimeout(() => setRowSaved((s) => ({ ...s, [id]: false })), 2500);
  }

  if (authState === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-navy border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (authState === "denied") {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <p className="text-sm text-gray-500">Admin access only.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-navy">Attorney Settings</h1>
        <p className="mt-1 text-sm text-charcoal/60">
          Set the platform attorney-review fee and the commission rate attorneys earn on the
          partners they recruit.
        </p>
      </div>

      {/* Review Fee */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-charcoal">Attorney Review Fee</h2>
        <p className="mt-1 text-xs text-gray-400">
          Charged to the client for an attorney review. Allowed range ${MIN_FEE}–${MAX_FEE}.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-charcoal/60">$</span>
            <input
              type="number"
              min={MIN_FEE}
              max={MAX_FEE}
              step={5}
              value={feeInput}
              onChange={(e) => { setFeeInput(Number(e.target.value)); setFeeSaved(false); setFeeError(""); }}
              className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold"
            />
          </div>
          <button
            onClick={saveFee}
            disabled={feeSaving}
            className="rounded-full bg-gold px-5 py-2 text-sm font-semibold text-white hover:bg-gold/90 disabled:opacity-50"
          >
            {feeSaving ? "Saving…" : "Save Fee"}
          </button>
          {feeSaved && <span className="text-xs font-medium text-green-600">Saved</span>}
          {feeError && <span className="text-xs font-medium text-red-600">{feeError}</span>}
        </div>
      </div>

      {/* Attorney Commissions */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-charcoal">Attorney Commission Rates</h2>
          <p className="mt-1 text-xs text-gray-400">
            Percentage an attorney earns on the platform fee of each partner they sign up.
          </p>
        </div>
        {attorneys.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-gray-400">No attorneys found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Attorney</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rate (%)</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                </tr>
              </thead>
              <tbody>
                {attorneys.map((a) => (
                  <tr key={a.id} className="border-b border-gray-50">
                    <td className="px-6 py-3">
                      <p className="font-medium text-charcoal">{a.full_name}</p>
                      <p className="text-xs text-gray-400">{a.email}</p>
                    </td>
                    <td className="px-6 py-3">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={pctInput[a.id] ?? 0}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setPctInput((s) => ({ ...s, [a.id]: v }));
                          setRowSaved((s) => ({ ...s, [a.id]: false }));
                          setRowError((s) => ({ ...s, [a.id]: "" }));
                        }}
                        className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold"
                      />
                    </td>
                    <td className="px-6 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => saveRow(a.id)}
                        disabled={rowSaving[a.id]}
                        className="rounded-full bg-navy px-4 py-1.5 text-xs font-semibold text-white hover:bg-navy/90 disabled:opacity-50"
                      >
                        {rowSaving[a.id] ? "Saving…" : "Save"}
                      </button>
                      {rowSaved[a.id] && <span className="ml-2 text-xs font-medium text-green-600">Saved</span>}
                      {rowError[a.id] && <span className="ml-2 text-xs font-medium text-red-600">{rowError[a.id]}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
