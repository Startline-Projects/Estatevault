import { z } from "zod";

const personSchema5 = z.object({
  full_name: z.string().default(""),
  relationship: z.string().default(""),
  city: z.string().default(""),
  state: z.string().default(""),
  phone: z.string().default(""),
});

const personSchema4 = z.object({
  full_name: z.string().default(""),
  relationship: z.string().default(""),
  city: z.string().default(""),
  state: z.string().default(""),
});

const personSchema3 = z.object({
  full_name: z.string().default(""),
  relationship: z.string().default(""),
  phone: z.string().default(""),
});

const lenientWillIntakeSchema = z.object({
  first_name: z.string().default(""),
  middle_name: z.string().default(""),
  last_name: z.string().default(""),
  suffix: z.string().default(""),
  date_of_birth: z.string().default(""),
  street_address: z.string().default(""),
  city: z.string().default(""),
  county: z.string().default(""),
  zip: z.string().default(""),
  marital_status: z.string().default(""),
  spouse_full_name: z.string().default(""),

  has_children: z.boolean().default(false),
  children: z.array(z.object({
    full_name: z.string().default(""),
    date_of_birth: z.string().default(""),
    is_minor: z.boolean().default(false),
  })).default([]),
  has_minor_children: z.boolean().default(false),

  personal_representative: personSchema5.default({ full_name: "", relationship: "", city: "", state: "", phone: "" }),
  successor_personal_representative: personSchema4.default({ full_name: "", relationship: "", city: "", state: "" }),
  second_successor_personal_representative: personSchema4.nullable().default(null),
  bond_waiver: z.boolean().default(true),
  independent_administration: z.boolean().default(true),

  primary_beneficiaries: z.array(z.object({
    full_name: z.string().default(""),
    relationship: z.string().default(""),
    share_percent: z.string().default(""),
    per_stirpes: z.boolean().default(false),
  })).default([]),
  contingent_beneficiaries: z.array(z.object({
    full_name: z.string().default(""),
    relationship: z.string().default(""),
    share_percent: z.string().default(""),
  })).default([]),
  intestate_acknowledgment: z.boolean().default(true),

  guardian: personSchema5.nullable().default(null),
  successor_guardian: z.object({
    full_name: z.string().default(""),
    relationship: z.string().default(""),
  }).nullable().default(null),
  standby_guardian: personSchema4.nullable().default(null),
  guardian_temporary_incapacity_authority: z.boolean().default(true),

  has_specific_gifts: z.boolean().default(false),
  specific_gifts: z.array(z.object({
    item_description: z.string().default(""),
    recipient_full_name: z.string().default(""),
    recipient_relationship: z.string().default(""),
    fallback: z.string().default(""),
  })).default([]),

  digital_executor_is_same: z.boolean().default(true),
  digital_executor: personSchema3.nullable().default(null),
  digital_asset_instructions: z.string().default("Decision left to my digital executor."),

  organ_donation: z.string().default(""),
  organ_donation_purposes: z.array(z.string()).default([]),
  funeral_preference: z.string().default("family_decides"),
  has_funeral_representative: z.boolean().default(false),
  funeral_representative: personSchema3.nullable().default(null),
  successor_funeral_representative: personSchema3.nullable().default(null),

  has_intentional_exclusions: z.boolean().default(false),
  intentional_exclusions: z.array(z.object({
    full_name: z.string().default(""),
    relationship: z.string().default(""),
  })).default([]),
  no_contest_clause: z.boolean().default(true),

  dpoa_agent: personSchema5.default({ full_name: "", relationship: "", city: "", state: "", phone: "" }),
  first_successor_dpoa_agent: personSchema5.default({ full_name: "", relationship: "", city: "", state: "", phone: "" }),
  second_successor_dpoa_agent: personSchema5.default({ full_name: "", relationship: "", city: "", state: "", phone: "" }),
  dpoa_powers: z.array(z.string()).default(["banking", "real_estate", "business", "tax", "insurance", "government_benefits", "retirement", "digital"]),
  dpoa_effective: z.string().default("immediate"),
  dpoa_agent_compensation: z.string().default("reasonable"),
  dpoa_agent_compensation_amount: z.string().nullable().default(null),

  patient_advocate: personSchema5.default({ full_name: "", relationship: "", city: "", state: "", phone: "" }),
  successor_patient_advocate: personSchema5.default({ full_name: "", relationship: "", city: "", state: "", phone: "" }),
  life_sustaining_treatment_preference: z.string().default(""),
  artificial_nutrition_preference: z.string().default(""),
  pain_management_preference: z.string().default("provide_even_if_shortens"),
  pregnancy_exclusion: z.string().default("no_pregnancy_restriction"),
  mental_health_treatment_authority: z.boolean().default(true),
  has_hipaa_additional_parties: z.boolean().default(false),
  hipaa_additional_authorized_parties: z.array(z.object({
    full_name: z.string().default(""),
    relationship: z.string().default(""),
  })).default([]),
});

export type TemplateWillIntake = z.infer<typeof lenientWillIntakeSchema>;

export const initialTemplateWillIntake: TemplateWillIntake = lenientWillIntakeSchema.parse({});

function yesNo(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.toLowerCase() === "yes" || v === "true";
  return false;
}

function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

// BUG-20: equal shares as whole percentages that ALWAYS sum to exactly 100.
// `Math.floor(100/count)` per head undershoots (3→99%, 6→96%), producing a
// legally incoherent residuary. Largest-remainder distributes the leftover
// 1% units to the first beneficiaries: 3→[34,33,33], 6→[17,17,17,17,16,16].
function equalShareSplit(count: number): string[] {
  if (count <= 0) return [];
  const base = Math.floor(100 / count);
  const remainder = 100 - base * count;
  return Array.from({ length: count }, (_, i) => String(base + (i < remainder ? 1 : 0)));
}

function mapBeneficiariesToPrimary(
  bens: unknown,
  equalShares: unknown,
): Array<{ full_name: string; relationship: string; share_percent: string; per_stirpes: boolean }> {
  if (!Array.isArray(bens)) return [];
  const equalSplit = yesNo(equalShares) ? equalShareSplit(bens.length) : null;
  return bens.map((b, i) => ({
    full_name: str(b?.name || b?.full_name),
    relationship: str(b?.relationship),
    share_percent: equalSplit ? equalSplit[i] : str(b?.share || b?.share_percent),
    per_stirpes: yesNo(b?.per_stirpes),
  }));
}

function mapBeneficiariesToContingent(
  bens: unknown,
  equalShares: unknown,
): Array<{ full_name: string; relationship: string; share_percent: string }> {
  if (!Array.isArray(bens)) return [];
  const equalSplit = yesNo(equalShares) ? equalShareSplit(bens.length) : null;
  return bens.map((b, i) => ({
    full_name: str(b?.name || b?.full_name),
    relationship: str(b?.relationship),
    share_percent: equalSplit ? equalSplit[i] : str(b?.share || b?.share_percent),
  }));
}

/**
 * Maps EstateVault quiz answers (camelCase flat or mixed) into the template
 * engine's WillIntake shape (snake_case nested). Returns a validated object
 * with defaults for all missing fields, or null if validation fails.
 */
export function mapIntakeToTemplateData(
  raw: Record<string, unknown>,
): { data: TemplateWillIntake; error: null } | { data: null; error: string } {
  try {
    const mapped: Record<string, unknown> = {};

    // Pass through any existing snake_case fields
    for (const [k, v] of Object.entries(raw)) {
      if (k.includes("_")) mapped[k] = v;
    }

    // Map camelCase → snake_case with structural transforms
    if (raw.firstName !== undefined) mapped.first_name = str(raw.firstName);
    if (raw.middleName !== undefined) mapped.middle_name = str(raw.middleName);
    if (raw.lastName !== undefined) mapped.last_name = str(raw.lastName);
    if (raw.suffix !== undefined) mapped.suffix = str(raw.suffix);
    if (raw.dateOfBirth !== undefined) mapped.date_of_birth = str(raw.dateOfBirth);
    if (raw.streetAddress !== undefined) mapped.street_address = str(raw.streetAddress);
    if (raw.city !== undefined) mapped.city = str(raw.city);
    if (raw.county !== undefined) mapped.county = str(raw.county);
    if (raw.zip !== undefined) mapped.zip = str(raw.zip);
    if (raw.state !== undefined && !mapped.state) mapped.state = str(raw.state);
    if (raw.maritalStatus !== undefined) mapped.marital_status = str(raw.maritalStatus);
    if (raw.spouseFullName !== undefined) mapped.spouse_full_name = str(raw.spouseFullName);
    if (raw.spouseName !== undefined && !mapped.spouse_full_name) mapped.spouse_full_name = str(raw.spouseName);

    // Children
    if (raw.hasMinorChildren !== undefined) {
      mapped.has_minor_children = yesNo(raw.hasMinorChildren);
      if (!mapped.has_children) mapped.has_children = yesNo(raw.hasMinorChildren);
    }

    // Personal representative (executor)
    if (raw.executorName || raw.executorRelationship) {
      mapped.personal_representative = {
        full_name: str(raw.executorName),
        relationship: str(raw.executorRelationship),
        city: str(raw.executorCity || raw.city),
        state: str(raw.executorState || raw.state),
        phone: str(raw.executorPhone || ""),
      };
    }
    if (raw.successorExecutorName || raw.successorExecutorRelationship) {
      mapped.successor_personal_representative = {
        full_name: str(raw.successorExecutorName),
        relationship: str(raw.successorExecutorRelationship),
        city: str(raw.successorExecutorCity || ""),
        state: str(raw.successorExecutorState || ""),
      };
    }

    // Beneficiaries
    if (raw.beneficiaries !== undefined) {
      mapped.primary_beneficiaries = mapBeneficiariesToPrimary(
        raw.beneficiaries,
        raw.beneficiariesEqualShares,
      );
    }
    if (raw.contingentBeneficiaries !== undefined) {
      mapped.contingent_beneficiaries = mapBeneficiariesToContingent(
        raw.contingentBeneficiaries,
        raw.contingentEqualShares,
      );
    }

    // Guardian
    if (raw.guardianName) {
      mapped.guardian = {
        full_name: str(raw.guardianName),
        relationship: str(raw.guardianRelationship || ""),
        city: "",
        state: "",
        phone: "",
      };
    }
    if (raw.successorGuardianName) {
      mapped.successor_guardian = {
        full_name: str(raw.successorGuardianName),
        relationship: "",
      };
    }

    // Specific gifts
    if (raw.hasSpecificGifts !== undefined) {
      mapped.has_specific_gifts = yesNo(raw.hasSpecificGifts);
    }

    // Organ donation
    if (raw.organDonation !== undefined) mapped.organ_donation = str(raw.organDonation);

    // DPOA fields (if quiz collected them)
    if (raw.dpoaAgentName || raw.poaAgentName) {
      mapped.dpoa_agent = {
        full_name: str(raw.dpoaAgentName || raw.poaAgentName),
        relationship: str(raw.dpoaAgentRelationship || raw.poaAgentRelationship || ""),
        city: str(raw.dpoaAgentCity || ""),
        state: str(raw.dpoaAgentState || ""),
        phone: str(raw.dpoaAgentPhone || ""),
      };
    }

    // Patient advocate (if quiz collected)
    if (raw.patientAdvocateName || raw.healthcareAgentName) {
      mapped.patient_advocate = {
        full_name: str(raw.patientAdvocateName || raw.healthcareAgentName),
        relationship: str(raw.patientAdvocateRelationship || raw.healthcareAgentRelationship || ""),
        city: "",
        state: "",
        phone: "",
      };
    }

    // Healthcare directive preferences
    if (raw.lifeSustainingTreatment !== undefined) {
      mapped.life_sustaining_treatment_preference = str(raw.lifeSustainingTreatment);
    }
    if (raw.artificialNutrition !== undefined) {
      mapped.artificial_nutrition_preference = str(raw.artificialNutrition);
    }

    const result = lenientWillIntakeSchema.safeParse(mapped);
    if (!result.success) {
      return { data: null, error: result.error.message };
    }

    return { data: result.data, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : String(e) };
  }
}
