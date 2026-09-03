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
  /** Only meaningful when organDonation is "specific_purposes". */
  organDonationPurposes: string;
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
  secondSuccessorPatientAdvocateName: string;
  hasHealthcareWishes: string;
  healthcareWishesDescription: string;
  /** "burial" | "cremation" | "family_decides" — the will's Section 8.2. */
  funeralPreference: string;
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
  organDonationPurposes: "",
  poaAgentName: "",
  poaAgentRelationship: "",
  poaSuccessorAgentName: "",
  poaSuccessorAgentRelationship: "",
  poaPowers: ["Banking and finances", "Real estate transactions", "Business operations", "Tax filings"],
  poaEffective: "",
  patientAdvocateName: "",
  patientAdvocateRelationship: "",
  successorPatientAdvocateName: "",
  secondSuccessorPatientAdvocateName: "",
  hasHealthcareWishes: "",
  healthcareWishesDescription: "",
  funeralPreference: "",
  hasSpecificGifts: "",
  specificGiftsDescription: "",
};
