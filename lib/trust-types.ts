export interface TrustIntake {
  // About you
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  city: string;
  trustName: string;
  // Trustee
  primaryTrustee: string;
  trusteeName: string;
  successorTrusteeName: string;
  successorTrusteeRelationship: string;
  additionalSuccessorTrustees: Array<{ name: string; relationship: string }>;
  // Beneficiaries
  beneficiaries: Array<{ name: string; relationship: string; share: string }>;
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
  // Power of attorney
  poaAgentName: string;
  poaAgentRelationship: string;
  poaSuccessorAgentName: string;
  poaPowers: string[];
  // Healthcare directive
  patientAdvocateName: string;
  patientAdvocateRelationship: string;
  successorPatientAdvocateName: string;
  organDonation: string;
  hasHealthcareWishes: string;
  healthcareWishesDescription: string;
  // Contingent beneficiaries
  hasContingentBeneficiary: string;
  contingentBeneficiaries: Array<{ name: string; relationship: string; share: string }>;
  contingentEqualShares: string;
  // Specific gifts
  hasSpecificGifts: string;
  specificGiftsDescription: string;
}

export const initialTrustIntake: TrustIntake = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  city: "",
  trustName: "",
  primaryTrustee: "",
  trusteeName: "",
  successorTrusteeName: "",
  successorTrusteeRelationship: "",
  additionalSuccessorTrustees: [],
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
  poaAgentName: "",
  poaAgentRelationship: "",
  poaSuccessorAgentName: "",
  poaPowers: ["Banking and finances"],
  patientAdvocateName: "",
  patientAdvocateRelationship: "",
  successorPatientAdvocateName: "",
  organDonation: "",
  hasHealthcareWishes: "",
  healthcareWishesDescription: "",
  hasContingentBeneficiary: "",
  contingentBeneficiaries: [],
  contingentEqualShares: "",
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
