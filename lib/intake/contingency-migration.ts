/*
 * Carrying an old global contingency answer forward to the per-beneficiary one.
 *
 * The questionnaire used to ask once — "contingent beneficiaries: yes or no" —
 * plus a global list. It now asks per beneficiary what happens to THAT person's
 * share. A saved session from before the change has an answer that must not be
 * thrown away, but the two shapes do not map cleanly in every case:
 *
 *   old "Yes" + exactly one contingent named
 *       → unambiguous: that person takes each share. Pre-selects
 *         "named_individual" with the name filled in.
 *
 *   old "Yes" + several contingents named
 *       → ambiguous: a per-beneficiary answer names ONE person, and the old
 *         answer named several with no indication of which share each replaced.
 *         Nothing is pre-selected; the previous answer is carried in
 *         `priorAnswerSummary` so the client is shown what they said before and
 *         can re-express it.
 *
 *   old "No"
 *       → the client declined a global contingent, which says nothing about
 *         what should happen to an individual share. Nothing is pre-selected.
 *
 * Nothing dispositive is ever defaulted: a pre-selection is a starting point the
 * client sees and confirms on the step, not an answer made on their behalf.
 */

export interface LegacyContingentBeneficiary {
  name?: string;
  relationship?: string;
  share?: string;
}

export interface BeneficiaryShape {
  name: string;
  relationship: string;
  share: string;
  contingency?: string;
  contingentName?: string;
}

export interface ContingencyMigration {
  beneficiaries: BeneficiaryShape[];
  /** Human-readable note about a previous answer that could not be mapped. */
  priorAnswerSummary: string | null;
  /** True when anything was carried forward. */
  migrated: boolean;
}

function named(list: unknown): LegacyContingentBeneficiary[] {
  if (!Array.isArray(list)) return [];
  return list.filter((b) => typeof b?.name === "string" && b.name.trim() !== "");
}

/**
 * Maps a saved intake's old contingency answer onto the per-beneficiary shape.
 * Beneficiaries that already carry a `contingency` are left alone.
 */
export function migrateContingency(intake: Record<string, unknown>): ContingencyMigration {
  const beneficiaries = (Array.isArray(intake.beneficiaries) ? intake.beneficiaries : []) as BeneficiaryShape[];
  const alreadyMigrated = beneficiaries.some((b) => b.contingency);
  if (alreadyMigrated) {
    return { beneficiaries, priorAnswerSummary: null, migrated: false };
  }

  const had = String(intake.hasContingentBeneficiary ?? "").toLowerCase() === "yes";
  const contingents = named(intake.contingentBeneficiaries);

  if (!had || contingents.length === 0) {
    // Declining a global contingent says nothing about an individual share.
    return { beneficiaries, priorAnswerSummary: null, migrated: false };
  }

  if (contingents.length === 1) {
    const name = String(contingents[0].name).trim();
    return {
      beneficiaries: beneficiaries.map((b) => ({
        ...b,
        contingency: "named_individual",
        contingentName: name,
      })),
      priorAnswerSummary: null,
      migrated: true,
    };
  }

  const names = contingents.map((c) => String(c.name).trim()).filter(Boolean);
  return {
    beneficiaries,
    priorAnswerSummary:
      `You previously named ${names.join(", ")} as contingent beneficiaries. ` +
      "That answer applied to your whole estate; this question is now asked for each beneficiary separately, so please choose again below.",
    migrated: false,
  };
}

/** True when a saved intake still carries the old shape and needs the step again. */
export function needsContingencyMigration(intake: Record<string, unknown> | null | undefined): boolean {
  if (!intake) return false;
  const beneficiaries = Array.isArray(intake.beneficiaries) ? intake.beneficiaries : [];
  if (beneficiaries.length === 0) return false;
  return beneficiaries.some((b: BeneficiaryShape) => b?.name?.trim() && !b.contingency);
}
