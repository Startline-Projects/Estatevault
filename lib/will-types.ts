export interface WillIntake {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  city: string;
  state: string;
  maritalStatus: string;
  hasMinorChildren: string;
  executorName: string;
  executorRelationship: string;
  successorExecutorName: string;
  successorExecutorRelationship: string;
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
  state: "",
  maritalStatus: "",
  hasMinorChildren: "",
  executorName: "",
  executorRelationship: "",
  successorExecutorName: "",
  successorExecutorRelationship: "",
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
