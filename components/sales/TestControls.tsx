"use client";

import { useState, useEffect } from "react";

export default function TestControls() {
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/test-promo");
        const data = await res.json();
        setActive(data.active);
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, []);

  async function handleToggle() {
    setToggling(true);
    try {
      const res = await fetch("/api/admin/test-promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      });
      const data = await res.json();
      if (data.success) setActive(data.active);
    } catch { /* ignore */ }
    setToggling(false);
  }

  if (loading) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
        <h2 className="text-sm font-semibold text-charcoal">Test Controls</h2>
        <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-navy/10 text-navy">Admin Only</span>
      </div>
      <div className="px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-charcoal">Test Promo Code</p>
            <p className="text-xs text-gray-400 mt-0.5">Code &quot;Test&quot; for internal document review, no accounts created</p>
          </div>
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors disabled:opacity-50 ${active ? "bg-green-500" : "bg-gray-300"}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${active ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          {active ? "Active, Mike can use \"Test\" promo code" : "Inactive, \"Test\" code returns invalid"}
        </p>
      </div>
    </div>
  );
}
