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

// Option descriptions supplied by the reviewing attorney (round 2, items 15
// and 16) and integrated verbatim. The labels were approved 2026-09-13.
// Each `value` maps 1:1 to a {{#IF funeral_preference ...}} branch in the Will
// and, since the funeral section was added to it, the Pour-Over Will.
export const FUNERAL_PREFERENCE_OPTIONS = [
  {
    value: "burial",
    label: "Burial",
    description: "I prefer to be buried.",
  },
  {
    value: "cremation",
    label: "Cremation",
    description: "I prefer to be cremated.",
  },
  {
    value: "family_decides",
    label: "Leave the decision to my Personal Representative",
    description:
      "My Personal Representative shall make all decisions regarding my funeral, burial, and other final arrangements.",
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
