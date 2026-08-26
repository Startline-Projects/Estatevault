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
const POA_REQUIREMENTS: FieldRequirement[] = [
  { field: "poaAgentName", step: "poa", isAnswered: nonEmptyString("poaAgentName") },
  { field: "poaAgentRelationship", step: "poa", isAnswered: nonEmptyString("poaAgentRelationship") },
  { field: "poaPowers", step: "poa", isAnswered: nonEmptyArray("poaPowers") },
  { field: "poaEffective", step: "poa", isAnswered: nonEmptyString("poaEffective") },
];

const PAD_REQUIREMENTS: FieldRequirement[] = [
  { field: "patientAdvocateName", step: "healthcare", isAnswered: nonEmptyString("patientAdvocateName") },
  { field: "patientAdvocateRelationship", step: "healthcare", isAnswered: nonEmptyString("patientAdvocateRelationship") },
  { field: "lifeSustainingTreatment", step: "healthcare", isAnswered: nonEmptyString("lifeSustainingTreatment") },
  { field: "artificialNutrition", step: "healthcare", isAnswered: nonEmptyString("artificialNutrition") },
  { field: "organDonation", step: "healthcare", isAnswered: nonEmptyString("organDonation") },
];

export const FLOW_REQUIREMENTS: Record<IntakeFlow, FieldRequirement[]> = {
  will: [...POA_REQUIREMENTS, ...PAD_REQUIREMENTS],
  trust: [...POA_REQUIREMENTS, ...PAD_REQUIREMENTS],
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
