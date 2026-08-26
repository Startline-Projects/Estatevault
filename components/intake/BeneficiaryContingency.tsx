"use client";

/*
 * Per-beneficiary contingency.
 *
 * Replaces the single "contingent beneficiaries: yes or no" question. For each
 * primary beneficiary the client answers what happens to THAT person's share,
 * which is what the documents actually need — a global list could not say which
 * share it replaced.
 *
 * Shared by the will and trust flows so the wording has one definition.
 */

import NameInput from "@/components/quiz/NameInput";
import QuestionLabel from "@/components/quiz/QuestionLabel";

/** What happens to one beneficiary's share if they do not survive. */
export type ContingencyChoice = "other_beneficiaries" | "descendants" | "named_individual";

export interface BeneficiaryWithContingency {
  name: string;
  relationship: string;
  share: string;
  /** Empty until the client answers. Never defaulted — this is dispositive. */
  contingency?: string;
  /** Only meaningful when contingency is "named_individual". */
  contingentName?: string;
}

// PENDING ATTORNEY APPROVAL — final wording comes from the reviewing attorney.
// Each `value` must stay in 1:1 correspondence with the {{#IF contingency ...}}
// branches in the will, trust and pour-over templates.
export const CONTINGENCY_OPTIONS: Array<{ value: ContingencyChoice; label: string; description: string }> = [
  {
    value: "other_beneficiaries",
    label: "To the other named beneficiaries equally",
    description: "Their share is divided equally among the other people you named above.",
  },
  {
    value: "descendants",
    label: "To their descendants equally, if any",
    description: "Their children take their share. If they have none, it goes to the other people you named above.",
  },
  {
    value: "named_individual",
    label: "To someone else I name",
    description: "Their share goes to one person you choose, who does not have to be named above.",
  },
];

/** True when every listed beneficiary has answered. */
export function contingenciesComplete(beneficiaries: readonly BeneficiaryWithContingency[]): boolean {
  return beneficiaries.every((b) => {
    if (!b.name.trim()) return true; // an empty row is handled by the name check
    if (!b.contingency) return false;
    if (b.contingency === "named_individual") return Boolean(b.contingentName?.trim());
    return true;
  });
}

/**
 * The follow-up shown under one beneficiary.
 *
 * Rendered per beneficiary rather than once, because the answer belongs to that
 * person's share.
 */
export function BeneficiaryContingency({
  beneficiary,
  onChange,
  soleBeneficiary,
}: {
  beneficiary: BeneficiaryWithContingency;
  onChange: (patch: Partial<BeneficiaryWithContingency>) => void;
  /** With only one beneficiary there are no "other named beneficiaries". */
  soleBeneficiary: boolean;
}) {
  const displayName = beneficiary.name.trim() || "this beneficiary";
  const options = soleBeneficiary
    ? CONTINGENCY_OPTIONS.filter((o) => o.value !== "other_beneficiaries")
    : CONTINGENCY_OPTIONS;

  return (
    <div className="mt-4 rounded-xl border-2 border-gray-100 bg-gray-50/60 px-4 py-4">
      {/* PENDING ATTORNEY APPROVAL — question wording. */}
      <QuestionLabel required>
        If {displayName} passes away before you, what happens to their share?
      </QuestionLabel>
      <div className="mt-2 space-y-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() =>
              onChange({
                contingency: opt.value,
                ...(opt.value === "named_individual" ? {} : { contingentName: "" }),
              })
            }
            className={`min-h-[44px] w-full rounded-xl border-2 px-4 py-3 text-left transition-all ${
              beneficiary.contingency === opt.value
                ? "border-gold bg-gold/10 text-navy"
                : "border-gray-200 bg-white text-charcoal hover:border-gold/40"
            }`}
          >
            <span className="block text-sm font-medium">{opt.label}</span>
            <span className="mt-1 block text-xs text-charcoal/60">{opt.description}</span>
          </button>
        ))}
      </div>
      {beneficiary.contingency === "named_individual" && (
        <div className="mt-3">
          <QuestionLabel required>Who should receive {displayName}&apos;s share?</QuestionLabel>
          <NameInput
            value={beneficiary.contingentName ?? ""}
            onChange={(v) => onChange({ contingentName: v })}
          />
        </div>
      )}
    </div>
  );
}

