"use client";

import { useState } from "react";
import Link from "next/link";

const EVENTS = [
  { id: "married", icon: "💍", title: "Got Married", description: "Update beneficiaries and consider adding your spouse as trustee or executor.", urgent: false, recommendation: "Update your beneficiary designations and consider adding your spouse to your estate plan.", action: "amendment" },
  { id: "divorced", icon: "💔", title: "Got Divorced", description: "Michigan law may have affected your existing documents. Immediate review recommended.", urgent: true, recommendation: "Michigan automatically revokes certain provisions naming your ex-spouse. An immediate review of all documents is recommended.", action: "attorney" },
  { id: "new_child", icon: "👶", title: "New Child or Grandchild", description: "Add your child as a beneficiary and designate a guardian if they are a minor.", urgent: false, recommendation: "Add your new child as a beneficiary and ensure a guardian is designated.", action: "amendment" },
  { id: "property", icon: "🏠", title: "Bought or Sold Property", description: "Real estate changes may require deed transfers or trust updates.", urgent: false, recommendation: "If you have a trust, new property may need to be titled in the trust's name. Sold property should be removed.", action: "amendment" },
  { id: "business", icon: "💼", title: "Started or Sold a Business", description: "Business ownership significantly affects your estate plan.", urgent: false, recommendation: "Business interests require careful estate planning. We recommend attorney review for this change.", action: "attorney" },
  { id: "death", icon: "🕊", title: "Loss of a Beneficiary or Trustee", description: "Your plan references someone who has passed. An update is needed.", urgent: true, recommendation: "Your estate plan names someone who is no longer living. Successor provisions may apply, but an update is recommended.", action: "amendment" },
  { id: "health", icon: "🏥", title: "Health Diagnosis", description: "Consider reviewing your healthcare directive and power of attorney.", urgent: false, recommendation: "Review your healthcare directive to ensure your wishes are current, and confirm your patient advocate is still appropriate.", action: "amendment" },
  { id: "assets", icon: "💰", title: "Significant Change in Assets", description: "Major asset changes — inheritance, large purchase, retirement account changes — may affect your plan.", urgent: false, recommendation: "Significant changes in net worth may affect which estate planning strategy is best for you.", action: "amendment" },
];

export default function LifeEventsPage() {
  const [selected, setSelected] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
    setShowResults(false);
  }

  const selectedEvents = EVENTS.filter((e) => selected.includes(e.id));

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-navy">Has anything changed in your life?</h1>
      <p className="mt-1 text-sm text-charcoal/60">Life events can affect your estate plan. Select anything that applies.</p>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {EVENTS.map((event) => {
          const isSelected = selected.includes(event.id);
          return (
            <button key={event.id} onClick={() => toggle(event.id)}
              className={`rounded-xl border-2 p-5 text-left transition-all ${isSelected ? "border-gold bg-gold/5 shadow-sm" : "border-gray-200 bg-white hover:border-gold/40"}`}>
              <div className="flex items-start justify-between">
                <span className="text-2xl">{event.icon}</span>
                <div className="flex items-center gap-2">
                  {event.urgent && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">URGENT</span>}
                  {isSelected && <span className="text-gold">✓</span>}
                </div>
              </div>
              <p className="mt-3 text-sm font-semibold text-navy">{event.title}</p>
              <p className="mt-1 text-xs text-charcoal/60">{event.description}</p>
            </button>
          );
        })}
      </div>

      {selected.length > 0 && !showResults && (
        <div className="mt-8 text-center">
          <button onClick={() => setShowResults(true)} className="inline-flex min-h-[44px] items-center rounded-full bg-gold px-8 py-3 text-sm font-semibold text-white hover:bg-gold/90 transition-colors">
            Review My Options
          </button>
        </div>
      )}

      {showResults && (
        <div className="mt-8 space-y-4">
          <h2 className="text-lg font-bold text-navy">Recommended Actions</h2>
          {selectedEvents.map((event) => (
            <div key={event.id} className="rounded-xl bg-white border border-gray-200 p-6">
              <div className="flex items-center gap-2">
                <span>{event.icon}</span>
                <h3 className="text-sm font-bold text-navy">{event.title}</h3>
                {event.urgent && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">URGENT</span>}
              </div>
              <p className="mt-2 text-sm text-charcoal/70">{event.recommendation}</p>
              <div className="mt-4">
                {event.action === "amendment" ? (
                  <Link href="/dashboard/amendment" className="inline-flex items-center rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy/90 transition-colors">
                    Request Amendment — $50
                  </Link>
                ) : (
                  <Link href="/attorney-referral" className="inline-flex items-center rounded-full bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition-colors">
                    This may require attorney review — Connect with an attorney
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
