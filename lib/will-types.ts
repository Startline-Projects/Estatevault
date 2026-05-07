export interface WillIntake {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  city: string;
  hasMinorChildren: string;
  executorName: string;
  executorRelationship: string;
  successorExecutorName: string;
  beneficiaries: Array<{ name: string; relationship: string; share: string }>;
  beneficiariesEqualShares: string;
  guardianName: string;
  guardianRelationship: string;
  successorGuardianName: string;
  hasContingentBeneficiary: string;
  contingentBeneficiaries: Array<{ name: string; relationship: string; share: string }>;
  contingentEqualShares: string;
  organDonation: string;
  hasSpecificGifts: string;
  specificGiftsDescription: string;
}

export const initialWillIntake: WillIntake = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  city: "",
  hasMinorChildren: "",
  executorName: "",
  executorRelationship: "",
  successorExecutorName: "",
  beneficiaries: [{ name: "", relationship: "", share: "" }],
  beneficiariesEqualShares: "",
  guardianName: "",
  guardianRelationship: "",
  successorGuardianName: "",
  hasContingentBeneficiary: "",
  contingentBeneficiaries: [],
  contingentEqualShares: "",
  organDonation: "",
  hasSpecificGifts: "",
  specificGiftsDescription: "",
};
