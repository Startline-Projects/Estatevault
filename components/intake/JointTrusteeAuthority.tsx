"use client";

/*
 * Joint trusts only: may either Co-Trustee act alone, or must they act together?
 *
 * The answer selects between two operative branches of Article III, Section 3.1,
 * so it is dispositive and carries no default.
 */

import QuestionLabel from "@/components/quiz/QuestionLabel";

// PENDING ATTORNEY APPROVAL — final wording comes from the reviewing attorney.
// Values map 1:1 to the {{#IF joint_trustee_authority ...}} branches in
// lib/documents/templates/trust-michigan-v1.1.0.txt.
export const JOINT_TRUSTEE_AUTHORITY_OPTIONS = [
  {
    value: "either_alone",
    label: "Either of us may act alone",
    description: "Either Co-Trustee can transact business for the Trust without the other.",
  },
  {
    value: "jointly",
    label: "We must act together",
    description: "Every exercise of the Trust's powers needs both Co-Trustees.",
  },
];

export function JointTrusteeAuthority({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mt-5">
      <QuestionLabel required>How should your Co-Trustees act?</QuestionLabel>
      <div className="space-y-3">
        {JOINT_TRUSTEE_AUTHORITY_OPTIONS.map((opt) => (
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
