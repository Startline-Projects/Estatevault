export interface TrustIntake {
  // About you
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  city: string;
  state: string;
  maritalStatus: string;
  hasSpecialNeedsDependent: string;
  trustName: string;
  // Trustee
  primaryTrustee: string;
  trusteeName: string;
  successorTrusteeName: string;
  successorTrusteeRelationship: string;
  additionalSuccessorTrustees: Array<{ name: string; relationship: string }>;
  /** Joint trusts only: "either_alone" | "jointly". */
  /** "Yes" | "No" — a joint trust also needs the second grantor named. */
  isJointTrust: string;
  secondGrantorName: string;
  secondGrantorRelationship: string;
  jointTrusteeAuthority: string;
  // Beneficiaries
  /**
   * Each beneficiary carries its own contingency: what happens to THAT share if
   * they do not survive. `contingency` is empty until answered — never
   * defaulted, because it is dispositive.
   */
  beneficiaries: Array<{ name: string; relationship: string; share: string; contingency?: string; contingentName?: string }>;
  beneficiariesEqualShares: string;
  distributionAge: string;
  // Guardian
  hasMinorChildren: string;
  guardianName: string;
  guardianRelationship: string;
  successorGuardianName: string;
  // Assets
  assetTypes: string[];
  // Pour-over will
  executorName: string;
  executorRelationship: string;
  successorExecutorName: string;
  successorExecutorRelationship: string;
  // Power of attorney
  poaAgentName: string;
  poaAgentRelationship: string;
  poaSuccessorAgentName: string;
  poaSuccessorAgentRelationship: string;
  poaPowers: string[];
  /** "immediate" | "springing" — drives Article III of the DPOA. */
  poaEffective: string;
  // Healthcare directive
  patientAdvocateName: string;
  patientAdvocateRelationship: string;
  successorPatientAdvocateName: string;
  secondSuccessorPatientAdvocateName: string;
  organDonation: string;
  /** Only meaningful when organDonation is "specific_purposes". */
  organDonationPurposes: string;
  hasHealthcareWishes: string;
  healthcareWishesDescription: string;
  // Contingent beneficiaries
  hasContingentBeneficiary: string;
  contingentBeneficiaries: Array<{ name: string; relationship: string; share: string }>;
  contingentEqualShares: string;
  // Specific gifts
  /** "burial" | "cremation" | "family_decides" — the will's Section 8.2. */
  funeralPreference: string;
  hasSpecificGifts: string;
  specificGiftsDescription: string;
}

export const initialTrustIntake: TrustIntake = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  city: "",
  state: "",
  maritalStatus: "",
  hasSpecialNeedsDependent: "",
  trustName: "",
  primaryTrustee: "",
  trusteeName: "",
  successorTrusteeName: "",
  successorTrusteeRelationship: "",
  additionalSuccessorTrustees: [],
  isJointTrust: "",
  secondGrantorName: "",
  secondGrantorRelationship: "",
  jointTrusteeAuthority: "",
  beneficiaries: [{ name: "", relationship: "", share: "" }],
  beneficiariesEqualShares: "",
  distributionAge: "",
  hasMinorChildren: "",
  guardianName: "",
  guardianRelationship: "",
  successorGuardianName: "",
  assetTypes: [],
  executorName: "",
  executorRelationship: "",
  successorExecutorName: "",
  successorExecutorRelationship: "",
  poaAgentName: "",
  poaAgentRelationship: "",
  poaSuccessorAgentName: "",
  poaSuccessorAgentRelationship: "",
  poaPowers: ["Banking and finances", "Real estate transactions", "Business operations", "Tax filings"],
  poaEffective: "immediate",
  patientAdvocateName: "",
  patientAdvocateRelationship: "",
  successorPatientAdvocateName: "",
  secondSuccessorPatientAdvocateName: "",
  organDonation: "",
  organDonationPurposes: "",
  hasHealthcareWishes: "",
  healthcareWishesDescription: "",
  hasContingentBeneficiary: "",
  contingentBeneficiaries: [],
  contingentEqualShares: "",
  funeralPreference: "",
  hasSpecificGifts: "",
  specificGiftsDescription: "",
};

export interface ComplexityResult {
  flagged: boolean;
  reasons: string[];
}

export function checkComplexity(intake: TrustIntake): ComplexityResult {
  const reasons: string[] = [];

  if (intake.assetTypes.includes("Real estate in another state")) {
    reasons.push("Multi-state real estate");
  }
  if (intake.assetTypes.includes("Business interests")) {
    reasons.push("Business interests in trust");
  }
  if (intake.beneficiaries.length > 1 && intake.beneficiariesEqualShares === "No") {
    reasons.push("Unequal beneficiary split");
  }
  if (intake.hasHealthcareWishes === "Yes" && intake.healthcareWishesDescription.trim() !== "") {
    reasons.push("Custom healthcare wishes");
  }

  return { flagged: reasons.length > 0, reasons };
}
