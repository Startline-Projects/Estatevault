export interface WillIntake {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  city: string;
  state: string;
  maritalStatus: string;
  hasMinorChildren: string;
  hasSpecialNeedsDependent: string;
  executorName: string;
  executorRelationship: string;
  successorExecutorName: string;
  successorExecutorRelationship: string;
  /**
   * Each beneficiary carries its own contingency: what happens to THAT share if
   * they do not survive. `contingency` is empty until answered — never
   * defaulted, because it is dispositive.
   */
  beneficiaries: Array<{ name: string; relationship: string; share: string; contingency?: string; contingentName?: string }>;
  beneficiariesEqualShares: string;
  guardianName: string;
  guardianRelationship: string;
  successorGuardianName: string;
  hasContingentBeneficiary: string;
  contingentBeneficiaries: Array<{ name: string; relationship: string; share: string }>;
  contingentEqualShares: string;
  organDonation: string;
  // Power of Attorney — a will order generates a POA, so the will flow must
  // collect the same answers the trust flow does.
  poaAgentName: string;
  poaAgentRelationship: string;
  poaSuccessorAgentName: string;
  poaSuccessorAgentRelationship: string;
  poaPowers: string[];
  poaEffective: string;
  // Patient Advocate Designation — likewise.
  patientAdvocateName: string;
  patientAdvocateRelationship: string;
  successorPatientAdvocateName: string;
  lifeSustainingTreatment: string;
  artificialNutrition: string;
  hasHealthcareWishes: string;
  healthcareWishesDescription: string;
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
  hasSpecialNeedsDependent: "",
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
  poaAgentName: "",
  poaAgentRelationship: "",
  poaSuccessorAgentName: "",
  poaSuccessorAgentRelationship: "",
  poaPowers: ["Banking and finances"],
  poaEffective: "",
  patientAdvocateName: "",
  patientAdvocateRelationship: "",
  successorPatientAdvocateName: "",
  lifeSustainingTreatment: "",
  artificialNutrition: "",
  hasHealthcareWishes: "",
  healthcareWishesDescription: "",
  hasSpecificGifts: "",
  specificGiftsDescription: "",
};
