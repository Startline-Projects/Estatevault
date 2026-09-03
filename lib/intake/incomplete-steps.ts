/*
 * Routing a saved intake back to the questionnaire step that can complete it.
 *
 * When a new required question is added, sessions saved before the deploy reach
 * checkout without an answer. Failing Zod validation there is a dead end: the
 * client is told their answers are invalid with no way to fix it, and the
 * answer genuinely does not exist because they were never asked.
 *
 * Instead the session is routed back to the step that asks the missing
 * question, with every existing answer preserved. This is deliberately generic
 * — a requirement is a field, a predicate, and the step that collects it — so
 * adding a question later means adding a row, not new plumbing.
 */

/** Questionnaire flows that can be resumed. */
export type IntakeFlow = "will" | "trust";

export interface FieldRequirement {
  /** Intake field this requirement is about. Surfaced for diagnostics. */
  field: string;
  /** Step id in the flow's card list that collects it. */
  step: string;
  /** True when the saved intake already answers it. */
  isAnswered: (intake: Record<string, unknown>) => boolean;
}

function nonEmptyString(field: string) {
  return (intake: Record<string, unknown>) => {
    const v = intake[field];
    return typeof v === "string" && v.trim() !== "";
  };
}

/**
 * Every listed beneficiary must carry a contingency answer. Added by the
 * per-beneficiary contingency change: sessions saved before it have
 * beneficiaries with no answer, and a global yes/no that no longer applies.
 */
function everyBeneficiaryHasContingency(intake: Record<string, unknown>): boolean {
  const list = Array.isArray(intake.beneficiaries) ? intake.beneficiaries : [];
  if (list.length === 0) return true; // the missing-beneficiary case is Zod's
  return list.every((b: { name?: string; contingency?: string; contingentName?: string }) => {
    if (!b?.name?.trim()) return true;
    if (!b.contingency) return false;
    if (b.contingency === "named_individual") return Boolean(b.contingentName?.trim());
    return true;
  });
}

function nonEmptyArray(field: string) {
  return (intake: Record<string, unknown>) =>
    Array.isArray(intake[field]) && (intake[field] as unknown[]).length > 0;
}

/**
 * Requirements introduced after launch, in the order their steps appear.
 *
 * Only fields a pre-existing session can legitimately be missing belong here.
 * Fields that were always collected stay with Zod as before.
 */
/**
 * Joint trusts. A session saved before the joint-trust question was added has
 * no answer, and whether two people own the trust together is dispositive, so
 * it is asked rather than assumed. The co-trustee authority question only
 * exists once the client says the trust is joint and names the other grantor.
 */
const TRUSTEE_REQUIREMENTS: FieldRequirement[] = [
  { field: "isJointTrust", step: "trustee", isAnswered: nonEmptyString("isJointTrust") },
  {
    field: "jointTrusteeAuthority",
    step: "trustee",
    isAnswered: (intake) => {
      const joint = String(intake.isJointTrust ?? "").trim().toLowerCase() === "yes";
      const named = String(intake.secondGrantorName ?? "").trim() !== "";
      if (!joint || !named) return true;
      return nonEmptyString("jointTrusteeAuthority")(intake);
    },
  },
];

const BENEFICIARY_REQUIREMENTS: FieldRequirement[] = [
  { field: "beneficiaries[].contingency", step: "beneficiaries", isAnswered: everyBeneficiaryHasContingency },
];

const FINAL_WISHES_REQUIREMENTS: FieldRequirement[] = [
  { field: "funeralPreference", step: "gifts", isAnswered: nonEmptyString("funeralPreference") },
];

const POA_REQUIREMENTS: FieldRequirement[] = [
  { field: "poaAgentName", step: "poa", isAnswered: nonEmptyString("poaAgentName") },
  { field: "poaAgentRelationship", step: "poa", isAnswered: nonEmptyString("poaAgentRelationship") },
  { field: "poaPowers", step: "poa", isAnswered: nonEmptyArray("poaPowers") },
  { field: "poaEffective", step: "poa", isAnswered: nonEmptyString("poaEffective") },
];

const PAD_REQUIREMENTS: FieldRequirement[] = [
  { field: "patientAdvocateName", step: "healthcare", isAnswered: nonEmptyString("patientAdvocateName") },
  { field: "patientAdvocateRelationship", step: "healthcare", isAnswered: nonEmptyString("patientAdvocateRelationship") },
  { field: "organDonation", step: "healthcare", isAnswered: nonEmptyString("organDonation") },
];

// Ordered by where the steps appear, so a client walks forward through
// everything that is missing rather than being bounced backwards.
export const FLOW_REQUIREMENTS: Record<IntakeFlow, FieldRequirement[]> = {
  will: [...BENEFICIARY_REQUIREMENTS, ...POA_REQUIREMENTS, ...PAD_REQUIREMENTS, ...FINAL_WISHES_REQUIREMENTS],
  trust: [...TRUSTEE_REQUIREMENTS, ...BENEFICIARY_REQUIREMENTS, ...POA_REQUIREMENTS, ...PAD_REQUIREMENTS, ...FINAL_WISHES_REQUIREMENTS],
};

export interface ResumePoint {
  /** Step id to send the client back to. */
  step: string;
  /** Every unmet requirement, not only the first. */
  missingFields: string[];
}

/**
 * Where to resume a saved intake, or null when nothing is missing.
 *
 * The step is the one collecting the FIRST unmet requirement, so the client
 * walks forward through anything else also missing rather than being bounced
 * repeatedly.
 */
export function findResumePoint(
  flow: IntakeFlow,
  intake: Record<string, unknown> | null | undefined,
): ResumePoint | null {
  if (!intake) return null;
  const unmet = FLOW_REQUIREMENTS[flow].filter((r) => !r.isAnswered(intake));
  if (unmet.length === 0) return null;
  return { step: unmet[0].step, missingFields: unmet.map((r) => r.field) };
}

/** True when the saved intake can proceed to checkout. */
export function isIntakeComplete(
  flow: IntakeFlow,
  intake: Record<string, unknown> | null | undefined,
): boolean {
  return findResumePoint(flow, intake) === null;
}
