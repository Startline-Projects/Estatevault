export interface WillIntake {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  city: string;
  executorName: string;
  executorRelationship: string;
  successorExecutorName: string;
  primaryBeneficiaryName: string;
  primaryBeneficiaryRelationship: string;
  hasSecondBeneficiary: string;
  secondBeneficiaryName: string;
  secondBeneficiaryRelationship: string;
  estateSplit: string;
  customSplit: string;
  guardianName: string;
  guardianRelationship: string;
  successorGuardianName: string;
  hasContingentBeneficiary: string;
  contingentBeneficiaries: Array<{ name: string; relationship: string }>;
  hasSpecificGifts: string;
  specificGiftsDescription: string;
}

export const initialWillIntake: WillIntake = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  city: "",
  executorName: "",
  executorRelationship: "",
  successorExecutorName: "",
  primaryBeneficiaryName: "",
  primaryBeneficiaryRelationship: "",
  hasSecondBeneficiary: "",
  secondBeneficiaryName: "",
  secondBeneficiaryRelationship: "",
  estateSplit: "",
  customSplit: "",
  guardianName: "",
  guardianRelationship: "",
  successorGuardianName: "",
  hasContingentBeneficiary: "",
  contingentBeneficiaries: [],
  hasSpecificGifts: "",
  specificGiftsDescription: "",
};
