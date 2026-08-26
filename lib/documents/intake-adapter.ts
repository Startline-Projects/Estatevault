import { z } from "zod";
import { getMichiganCounty } from "./michigan-counties";

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
  /**
   * The current questionnaire collects specific gifts as one free-text field.
   * The template's structured `specific_gifts` loop needs item/recipient pairs,
   * which cannot be derived from prose without inventing recipients — so the
   * client's own words are carried verbatim here instead.
   */
  specific_gifts_freeform: z.string().default(""),
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

  trust_name: z.string().default(""),
  /**
   * A joint trust has two Grantors, who serve as co-Trustees. EstateVault does
   * not collect Social Security numbers, so the certification's taxpayer line
   * is left blank for the client to complete by hand.
   */
  is_joint_trust: z.boolean().default(false),
  grantor_2_full_name: z.string().default(""),
  grantor_2_relationship: z.string().default(""),
  grantor_2_address: z.string().default(""),
  /** Date the trust was executed, printed on the certification and assignment. */
  trust_date: z.string().default(""),
  /** Filled per-document when an Assignment of Personal Property is rendered. */
  assignor_full_name: z.string().default(""),
  assignor_city: z.string().default(""),
  assignor_state: z.string().default("Michigan"),
  assignment_trustee_line: z.string().default(""),
  trustee_is_self: z.boolean().default(true),
  trustee: personSchema4.default({ full_name: "", relationship: "", city: "", state: "" }),
  successor_trustee: personSchema4.default({ full_name: "", relationship: "", city: "", state: "" }),
  second_successor_trustee: personSchema4.nullable().default(null),
  distribution_age: z.number().default(18),
  assets: z.array(z.string()).default([]),

  dpoa_agent: personSchema5.default({ full_name: "", relationship: "", city: "", state: "", phone: "" }),
  first_successor_dpoa_agent: personSchema5.default({ full_name: "", relationship: "", city: "", state: "", phone: "" }),
  second_successor_dpoa_agent: personSchema5.default({ full_name: "", relationship: "", city: "", state: "", phone: "" }),
  // A power is granted ONLY if the client selected it. Defaulting this to the
  // full set silently granted real-estate/business/tax/retirement authority to
  // clients who asked for banking alone.
  dpoa_powers: z.array(z.string()).default([]),
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
  /** Free-text healthcare wishes from the questionnaire, carried verbatim. */
  healthcare_wishes_freeform: z.string().default(""),
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

// ── DPOA powers ───────────────────────────────────────────────────────────────
// The questionnaire presents four human-readable checkboxes; the template
// branches on snake_case tokens. Anything the client did not select must not
// appear in the output at all.
const POWER_LABEL_TO_TOKEN: Record<string, string> = {
  "banking and finances": "banking",
  "banking": "banking",
  "real estate transactions": "real_estate",
  "real estate": "real_estate",
  "business operations": "business",
  "business": "business",
  "tax filings": "tax",
  "tax": "tax",
  "insurance": "insurance",
  "government benefits": "government_benefits",
  "retirement": "retirement",
  "retirement accounts": "retirement",
  "digital assets": "digital",
  "digital": "digital",
  "gift making": "gift_making",
  "amend estate plan": "amend_estate_plan",
};

/** Every token the DPOA template understands. Used to pass through pre-tokenized input. */
const KNOWN_POWER_TOKENS = new Set(Object.values(POWER_LABEL_TO_TOKEN));

/**
 * Map selected powers to template tokens.
 *
 * Accepts the questionnaire's label array, an already-tokenized array, or the
 * legacy `{ real_estate: true }` object. Unrecognized entries are dropped rather
 * than guessed at. Banking is always included because the questionnaire makes it
 * mandatory and non-deselectable.
 */
function mapPoaPowers(raw: Record<string, unknown>): string[] | undefined {
  const tokens = new Set<string>();
  let sawAnySource = false;

  const list = raw.poaPowers ?? raw.dpoa_powers ?? raw.dpoaPowers;
  if (Array.isArray(list)) {
    sawAnySource = true;
    for (const entry of list) {
      const v = str(entry).trim();
      if (!v) continue;
      if (KNOWN_POWER_TOKENS.has(v)) { tokens.add(v); continue; }
      const token = POWER_LABEL_TO_TOKEN[v.toLowerCase()];
      if (token) tokens.add(token);
    }
  }

  const legacy = raw.powers;
  if (legacy && typeof legacy === "object" && !Array.isArray(legacy)) {
    sawAnySource = true;
    for (const [k, v] of Object.entries(legacy as Record<string, unknown>)) {
      if (v === true && KNOWN_POWER_TOKENS.has(k)) tokens.add(k);
    }
  }

  if (!sawAnySource) return undefined;
  // An empty selection is returned as-is so strict validation can block it.
  // Auto-granting banking here would mean inventing authority nobody chose.
  if (tokens.size === 0) return [];
  tokens.add("banking"); // mandatory in the questionnaire, never deselectable
  return Array.from(tokens);
}

// ── Organ donation ────────────────────────────────────────────────────────────
// The questionnaire stores Yes/No; the PAD template branches on
// yes_all / yes_specific / no / advocate_decides. An unmapped value matches no
// branch and renders a blank statutory section.
function mapOrganDonation(v: unknown): string | undefined {
  const raw = str(v).trim();
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  if (["yes_all", "yes_specific", "no", "advocate_decides"].includes(lower)) return lower;
  if (lower === "yes" || lower === "true") return "yes_all";
  if (lower === "no" || lower === "false") return "no";
  if (lower.startsWith("advocate")) return "advocate_decides";
  return undefined;
}

/**
 * Build primary beneficiaries from the pre-array questionnaire shape
 * (primaryBeneficiaryName / secondBeneficiaryName / estateSplit / customSplit).
 * In-progress intakes saved before the array migration still carry this shape;
 * without it they render an empty residuary clause.
 */
function mapLegacyBeneficiaries(
  raw: Record<string, unknown>,
): Array<{ full_name: string; relationship: string; share_percent: string; per_stirpes: boolean }> | undefined {
  const primary = str(raw.primaryBeneficiaryName || raw.primary_beneficiary).trim();
  if (!primary) return undefined;

  const secondary = str(raw.secondBeneficiaryName || raw.secondary_beneficiary).trim();
  const primaryRel = str(raw.primaryBeneficiaryRelationship || raw.primary_beneficiary_relationship);
  const secondaryRel = str(raw.secondBeneficiaryRelationship || raw.secondary_beneficiary_relationship);

  if (!secondary) {
    return [{ full_name: primary, relationship: primaryRel, share_percent: "100", per_stirpes: false }];
  }

  const split = str(raw.estateSplit || raw.estate_split).trim();
  let shares = ["50", "50"];
  if (split && split !== "50/50") {
    const custom = str(raw.customSplit || raw.custom_split).split("/");
    const a = custom[0]?.trim();
    const b = custom[1]?.trim();
    if (a && b) shares = [a, b];
  }

  return [
    { full_name: primary, relationship: primaryRel, share_percent: shares[0], per_stirpes: false },
    { full_name: secondary, relationship: secondaryRel, share_percent: shares[1], per_stirpes: false },
  ];
}

/**
 * The questionnaire only asks about shares when there is more than one
 * beneficiary, so a sole beneficiary arrives with share "" and no equal-shares
 * answer. That means 100%, not "unanswered" — without this a single-beneficiary
 * will is blocked for a share the client was never asked for.
 */
function soleOrStatedShare(count: number, b: { share?: unknown; share_percent?: unknown } | null): string {
  const stated = str(b?.share || b?.share_percent).trim();
  if (stated) return stated;
  return count === 1 ? "100" : "";
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
    share_percent: equalSplit ? equalSplit[i] : soleOrStatedShare(bens.length, b),
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
    share_percent: equalSplit ? equalSplit[i] : soleOrStatedShare(bens.length, b),
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
    // The questionnaire collects city but not county. Every template prints
    // "<county> County, Michigan" and the notary block needs it, so derive it
    // from the city when it was not asked for directly.
    if (!str(mapped.county).trim()) {
      const derived = getMichiganCounty(str(raw.city || mapped.city));
      if (derived && !derived.startsWith("___")) {
        mapped.county = derived.charAt(0) + derived.slice(1).toLowerCase();
      }
    }
    if (raw.zip !== undefined) mapped.zip = str(raw.zip);
    if (raw.state !== undefined && !mapped.state) mapped.state = str(raw.state);
    if (raw.maritalStatus !== undefined) mapped.marital_status = str(raw.maritalStatus);
    if (raw.spouseFullName !== undefined) mapped.spouse_full_name = str(raw.spouseFullName);
    if (raw.spouseName !== undefined && !mapped.spouse_full_name) mapped.spouse_full_name = str(raw.spouseName);

    // Children. The questionnaire currently asks only whether minor children
    // exist, so the roster is populated only when a caller supplies one.
    const rawChildren = raw.children ?? raw.childrenList;
    if (Array.isArray(rawChildren)) {
      mapped.children = rawChildren.map((c: Record<string, unknown>) => ({
        full_name: str(c?.full_name ?? c?.name),
        date_of_birth: str(c?.date_of_birth ?? c?.dateOfBirth),
        is_minor: yesNo(c?.is_minor ?? c?.isMinor),
      }));
      if (mapped.children && (mapped.children as unknown[]).length > 0) mapped.has_children = true;
    }

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
    // Pre-array questionnaire shape. Only consulted when the array shape is
    // absent or empty, so a migrated intake always wins.
    if (!Array.isArray(mapped.primary_beneficiaries) || (mapped.primary_beneficiaries as unknown[]).length === 0) {
      const legacyBens = mapLegacyBeneficiaries(raw);
      if (legacyBens) mapped.primary_beneficiaries = legacyBens;
    }

    if (raw.contingentBeneficiaries !== undefined) {
      mapped.contingent_beneficiaries = mapBeneficiariesToContingent(
        raw.contingentBeneficiaries,
        raw.contingentEqualShares,
      );
    }
    // An explicit "No" clears anything left over from an earlier answer.
    if (raw.hasContingentBeneficiary !== undefined && !yesNo(raw.hasContingentBeneficiary)) {
      mapped.contingent_beneficiaries = [];
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

    // Trust-specific fields
    if (raw.trustName !== undefined) mapped.trust_name = str(raw.trustName);

    // Joint trust. Marital status alone does not make a trust joint — the
    // client has to name a second grantor — so both are required before the
    // joint-trust branches render.
    const secondGrantor = str(raw.secondGrantorName ?? raw.grantor2Name ?? raw.grantor_2_full_name).trim();
    if (secondGrantor) {
      mapped.grantor_2_full_name = secondGrantor;
      mapped.grantor_2_relationship = str(raw.secondGrantorRelationship ?? raw.grantor_2_relationship ?? "Spouse");
      mapped.grantor_2_address = str(raw.secondGrantorAddress ?? raw.grantor_2_address ?? "");
      mapped.is_joint_trust = true;
    } else if (raw.isJointTrust !== undefined) {
      mapped.is_joint_trust = yesNo(raw.isJointTrust);
    }
    if (raw.trustDate !== undefined || raw.trust_date !== undefined) {
      mapped.trust_date = str(raw.trustDate ?? raw.trust_date);
    }
    if (raw.primaryTrustee !== undefined || raw.primary_trustee !== undefined) {
      mapped.trustee_is_self = str(raw.primaryTrustee || raw.primary_trustee) === "Myself";
    }
    if (raw.trusteeName || raw.trustee_name) {
      mapped.trustee = {
        full_name: str(raw.trusteeName || raw.trustee_name),
        relationship: str(raw.trusteeRelationship || ""),
        city: str(raw.trusteeCity || raw.city || ""),
        state: str(raw.trusteeState || raw.state || "Michigan"),
      };
    }
    if (raw.successorTrusteeName || raw.successor_trustee) {
      mapped.successor_trustee = {
        full_name: str(raw.successorTrusteeName || raw.successor_trustee),
        relationship: str(raw.successorTrusteeRelationship || ""),
        city: str(raw.successorTrusteeCity || ""),
        state: str(raw.successorTrusteeState || "Michigan"),
      };
    }
    if (raw.secondSuccessorTrusteeName || raw.second_successor_trustee) {
      const name = str(raw.secondSuccessorTrusteeName || raw.second_successor_trustee);
      if (name) {
        mapped.second_successor_trustee = {
          full_name: name,
          relationship: str(raw.secondSuccessorTrusteeRelationship || ""),
          city: str(raw.secondSuccessorTrusteeCity || ""),
          state: str(raw.secondSuccessorTrusteeState || "Michigan"),
        };
      }
    }
    if (raw.additionalSuccessorTrustees && Array.isArray(raw.additionalSuccessorTrustees)) {
      const additional = raw.additionalSuccessorTrustees as Array<{ name?: string; relationship?: string }>;
      if (!mapped.second_successor_trustee && additional[0]?.name) {
        mapped.second_successor_trustee = {
          full_name: str(additional[0].name),
          relationship: str(additional[0].relationship || ""),
          city: "",
          state: "Michigan",
        };
      }
    }
    if (raw.distributionAge !== undefined || raw.distribution_age !== undefined) {
      mapped.distribution_age = Number(raw.distributionAge || raw.distribution_age) || 18;
    }
    if (raw.assetTypes !== undefined || raw.assets !== undefined) {
      const rawAssets = raw.assetTypes || raw.assets;
      mapped.assets = Array.isArray(rawAssets) ? rawAssets.map((a: unknown) => str(a)) : [];
    }

    // Specific gifts
    if (raw.hasSpecificGifts !== undefined) {
      mapped.has_specific_gifts = yesNo(raw.hasSpecificGifts);
    }
    if (raw.specificGiftsDescription !== undefined) {
      mapped.specific_gifts_freeform = str(raw.specificGiftsDescription).trim();
    }
    if (Array.isArray(raw.specificGifts)) {
      mapped.specific_gifts = (raw.specificGifts as Array<Record<string, unknown>>).map((g) => ({
        item_description: str(g?.item_description ?? g?.description ?? g?.item),
        recipient_full_name: str(g?.recipient_full_name ?? g?.recipient ?? g?.name),
        recipient_relationship: str(g?.recipient_relationship ?? g?.relationship),
        fallback: str(g?.fallback || "residuary"),
      }));
    }

    // Organ donation — normalized to the tokens the PAD template branches on.
    const organ = mapOrganDonation(raw.organDonation ?? raw.organ_donation);
    if (organ) mapped.organ_donation = organ;

    // DPOA agent and successors
    if (raw.dpoaAgentName || raw.poaAgentName) {
      mapped.dpoa_agent = {
        full_name: str(raw.dpoaAgentName || raw.poaAgentName),
        relationship: str(raw.dpoaAgentRelationship || raw.poaAgentRelationship || ""),
        city: str(raw.dpoaAgentCity || raw.city || ""),
        state: str(raw.dpoaAgentState || raw.state || ""),
        phone: str(raw.dpoaAgentPhone || ""),
      };
    }
    if (raw.poaSuccessorAgentName || raw.dpoaSuccessorAgentName) {
      mapped.first_successor_dpoa_agent = {
        full_name: str(raw.poaSuccessorAgentName || raw.dpoaSuccessorAgentName),
        relationship: str(raw.poaSuccessorAgentRelationship || raw.dpoaSuccessorAgentRelationship || ""),
        city: str(raw.poaSuccessorAgentCity || ""),
        state: str(raw.poaSuccessorAgentState || ""),
        phone: str(raw.poaSuccessorAgentPhone || ""),
      };
    }
    if (raw.poaSecondSuccessorAgentName) {
      mapped.second_successor_dpoa_agent = {
        full_name: str(raw.poaSecondSuccessorAgentName),
        relationship: str(raw.poaSecondSuccessorAgentRelationship || ""),
        city: "",
        state: "",
        phone: "",
      };
    }

    // Powers actually selected by the client.
    const powers = mapPoaPowers(raw);
    if (powers) mapped.dpoa_powers = powers;

    if (raw.dpoaEffective !== undefined || raw.poaEffective !== undefined) {
      const eff = str(raw.dpoaEffective ?? raw.poaEffective).toLowerCase();
      if (eff === "springing" || eff === "immediate") mapped.dpoa_effective = eff;
    }

    // Patient advocate and successor
    if (raw.patientAdvocateName || raw.healthcareAgentName) {
      mapped.patient_advocate = {
        full_name: str(raw.patientAdvocateName || raw.healthcareAgentName),
        relationship: str(raw.patientAdvocateRelationship || raw.healthcareAgentRelationship || ""),
        city: str(raw.city || ""),
        state: str(raw.state || ""),
        phone: "",
      };
    }
    if (raw.successorPatientAdvocateName || raw.successorHealthcareAgentName) {
      mapped.successor_patient_advocate = {
        full_name: str(raw.successorPatientAdvocateName || raw.successorHealthcareAgentName),
        relationship: str(raw.successorPatientAdvocateRelationship || ""),
        city: "",
        state: "",
        phone: "",
      };
    }

    // Healthcare directive preferences
    if (raw.lifeSustainingTreatment !== undefined || raw.life_sustaining_treatment_preference !== undefined) {
      mapped.life_sustaining_treatment_preference = str(
        raw.lifeSustainingTreatment ?? raw.life_sustaining_treatment_preference,
      );
    }
    if (raw.artificialNutrition !== undefined || raw.artificial_nutrition_preference !== undefined) {
      mapped.artificial_nutrition_preference = str(
        raw.artificialNutrition ?? raw.artificial_nutrition_preference,
      );
    }
    if (raw.healthcareWishesDescription !== undefined && yesNo(raw.hasHealthcareWishes ?? "Yes")) {
      mapped.healthcare_wishes_freeform = str(raw.healthcareWishesDescription).trim();
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

// ── Strict per-document requirements ─────────────────────────────────────────
//
// The schema above is deliberately lenient: every field has a default, so
// `safeParse` succeeds on almost any input. That is right for drafts and for
// in-progress intakes, but it means a missing agent name or an unanswered
// treatment question produces a document with a blank clause rather than an
// error. These checks are the gate that has to pass before a document is
// rendered for delivery.

/** Values the PAD template branches on. Anything else renders an empty section. */
const LIFE_SUSTAINING_VALUES = [
  "continue_all",
  "withhold_if_terminal",
  "withhold_if_pvs",
  "withhold_if_terminal_or_pvs",
  "advocate_decides",
];
const ARTIFICIAL_NUTRITION_VALUES = [
  "provide_all",
  "withhold_if_terminal",
  "withhold_if_pvs",
  "withhold_if_terminal_or_pvs",
  "advocate_decides",
];
const ORGAN_DONATION_VALUES = ["yes_all", "yes_specific", "no", "advocate_decides"];

function person(name: string, label: string, out: string[]) {
  if (!name.trim()) out.push(label);
}

/** Gifts were requested but nothing usable was captured to render them from. */
function checkGifts(d: TemplateWillIntake, out: string[]) {
  if (d.has_specific_gifts && d.specific_gifts.length === 0 && !d.specific_gifts_freeform.trim()) {
    out.push("specific gifts were requested but no gift details were captured");
  }
}

function checkBeneficiaries(d: TemplateWillIntake, out: string[]) {
  if (d.primary_beneficiaries.length === 0) {
    out.push("at least one primary beneficiary");
    return;
  }
  d.primary_beneficiaries.forEach((b, i) => {
    if (!b.full_name.trim()) out.push(`primary beneficiary ${i + 1} name`);
    if (!b.share_percent.trim()) out.push(`primary beneficiary ${i + 1} share`);
  });
}

function checkIdentity(d: TemplateWillIntake, out: string[]) {
  if (!d.first_name.trim() || !d.last_name.trim()) out.push("client first and last name");
}

/**
 * Returns the list of missing/invalid requirements for a document type.
 * An empty array means the document can be rendered for delivery.
 *
 * @param docType - One of the template document types.
 * @param d - Adapter output.
 */
export function validateForDocument(docType: string, d: TemplateWillIntake): string[] {
  const out: string[] = [];
  checkIdentity(d, out);

  switch (docType) {
    case "will":
      person(d.personal_representative.full_name, "personal representative", out);
      checkBeneficiaries(d, out);
      checkGifts(d, out);
      break;

    case "trust":
      person(d.successor_trustee.full_name, "successor trustee", out);
      checkBeneficiaries(d, out);
      checkGifts(d, out);
      break;

    case "pour_over_will":
      person(d.personal_representative.full_name, "personal representative", out);
      person(d.successor_trustee.full_name, "successor trustee (named in the companion trust)", out);
      // Section 3.3 lists the trust's primary beneficiaries by name and share.
      // Without them the backup distribution clause would render empty.
      checkBeneficiaries(d, out);
      break;

    case "dpoa":
      person(d.dpoa_agent.full_name, "power of attorney agent", out);
      if (d.dpoa_powers.length === 0) out.push("at least one power granted to the agent");
      if (d.dpoa_effective !== "immediate" && d.dpoa_effective !== "springing") {
        out.push('effective date must be "immediate" or "springing"');
      }
      break;

    case "pad":
      person(d.patient_advocate.full_name, "patient advocate", out);
      if (!LIFE_SUSTAINING_VALUES.includes(d.life_sustaining_treatment_preference)) {
        out.push("life-sustaining treatment preference (not collected by the current questionnaire)");
      }
      if (!ARTIFICIAL_NUTRITION_VALUES.includes(d.artificial_nutrition_preference)) {
        out.push("artificial nutrition preference (not collected by the current questionnaire)");
      }
      if (!ORGAN_DONATION_VALUES.includes(d.organ_donation)) {
        out.push("organ donation preference");
      }
      break;

    case "certification_of_trust":
      // The taxpayer line is blank by design — EstateVault collects no SSNs —
      // so it is not a requirement. A trust name and a trustee are.
      if (!d.trust_name.trim() && !d.first_name.trim()) out.push("trust name");
      if (d.is_joint_trust && !d.grantor_2_full_name.trim()) {
        out.push("second grantor's name (this trust is marked joint)");
      }
      break;

    case "assignment_personal_property_g1":
      if (!d.first_name.trim()) out.push("assignor name");
      break;

    case "assignment_personal_property_g2":
      // Only exists for a joint trust, and only the second Grantor can sign it.
      if (!d.is_joint_trust) out.push("a joint trust (a second assignment exists only for two grantors)");
      if (!d.grantor_2_full_name.trim()) out.push("second grantor's name");
      break;

    case "trust_funding_instructions":
      // Educational; needs only enough to name the trust it belongs to.
      break;

    default:
      break;
  }

  return out;
}
