export interface TrustIntake {
  // About you
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  city: string;
  // Trustee
  primaryTrustee: string;
  trusteeName: string;
  successorTrusteeName: string;
  successorTrusteeRelationship: string;
  secondSuccessorTrusteeName: string;
  // Beneficiaries
  primaryBeneficiaryName: string;
  primaryBeneficiaryRelationship: string;
  hasSecondBeneficiary: string;
  secondBeneficiaryName: string;
  secondBeneficiaryRelationship: string;
  estateSplit: string;
  customSplit: string;
  distributionAge: string;
  // Guardian
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
  hasHealthcareWishes: string;
  healthcareWishesDescription: string;
  // Specific gifts
  hasSpecificGifts: string;
  specificGiftsDescription: string;
}

export const initialTrustIntake: TrustIntake = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  city: "",
  primaryTrustee: "",
  trusteeName: "",
  successorTrusteeName: "",
  successorTrusteeRelationship: "",
  secondSuccessorTrusteeName: "",
  primaryBeneficiaryName: "",
  primaryBeneficiaryRelationship: "",
  hasSecondBeneficiary: "",
  secondBeneficiaryName: "",
  secondBeneficiaryRelationship: "",
  estateSplit: "",
  customSplit: "",
  distributionAge: "",
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
  hasHealthcareWishes: "",
  healthcareWishesDescription: "",
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
  if (
    intake.hasSecondBeneficiary === "Yes" &&
    intake.estateSplit !== "50/50" &&
    intake.estateSplit !== ""
  ) {
    reasons.push("Unequal beneficiary split");
  }
  if (intake.hasHealthcareWishes === "Yes" && intake.healthcareWishesDescription.trim() !== "") {
    reasons.push("Custom healthcare wishes");
  }

  return { flagged: reasons.length > 0, reasons };
}
