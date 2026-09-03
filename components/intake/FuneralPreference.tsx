"use client";

/*
 * Funeral and burial preference.
 *
 * The will's Section 8.2 has three approved clauses and the client has to pick
 * one. Until now the field was never asked and always took its default, so
 * every will shipped a clause the client never chose.
 *
 * Dispositive, so there is no default.
 */

import QuestionLabel from "@/components/quiz/QuestionLabel";

// PENDING ATTORNEY APPROVAL — final wording comes from the reviewing attorney.
// Each `value` maps 1:1 to a {{#IF funeral_preference ...}} branch in
// lib/documents/templates/will-michigan-v1.1.0.txt.
export const FUNERAL_PREFERENCE_OPTIONS = [
  {
    value: "burial",
    label: "Burial",
    description: "You would prefer your remains to be interred by burial.",
  },
  {
    value: "cremation",
    label: "Cremation",
    description: "You would prefer your remains to be disposed of by cremation.",
  },
  {
    value: "family_decides",
    label: "Leave the decision to my Personal Representative",
    description: "You do not state a preference; the person carrying out your will decides.",
  },
];

export function FuneralPreference({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mt-6">
      <QuestionLabel required>What are your wishes for your remains?</QuestionLabel>
      <div className="space-y-3">
        {FUNERAL_PREFERENCE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`min-h-[44px] w-full rounded-xl border-2 px-5 py-3.5 text-left transition-all ${
              value === opt.value
                ? "border-gold bg-gold/10 text-navy"
                : "border-gray-200 bg-white text-charcoal hover:border-gold/40"
            }`}
          >
            <span className="block text-sm font-medium">{opt.label}</span>
            <span className="mt-1 block text-xs text-charcoal/60">{opt.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
