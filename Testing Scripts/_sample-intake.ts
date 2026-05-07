export const sampleIntake: Record<string, unknown> = {
  // Identity
  firstName: "John",
  lastName: "Smith",
  full_name: "John Smith",
  dateOfBirth: "1985-06-15",
  city: "Detroit",
  trustName: "",

  // Trust — trustee
  primaryTrustee: "Myself",
  trusteeName: "John Smith",
  successorTrusteeName: "Jane Smith",
  successorTrusteeRelationship: "Spouse",
  additionalSuccessorTrustees: [{ name: "Michael Smith", relationship: "Sibling" }],

  // Beneficiaries
  beneficiaries: [
    { name: "Jane Smith", relationship: "Spouse", share: "" },
    { name: "Emma Smith", relationship: "Daughter", share: "" },
  ],
  beneficiariesEqualShares: "Yes",
  distributionAge: "25",

  // Guardian (for minor children)
  hasMinorChildren: "Yes",
  guardianName: "Sarah Smith",
  guardianRelationship: "Sister",
  successorGuardianName: "Robert Smith",

  // Assets (triggers funding instructions sections)
  assetTypes: [
    "Primary home / real estate in Michigan",
    "Bank and investment accounts",
    "Vehicles",
    "Personal property and valuables",
  ],

  // Executor (will + pour-over will)
  executorName: "Jane Smith",
  executorRelationship: "Spouse",
  successorExecutorName: "Michael Smith",

  // Power of Attorney
  poaAgentName: "Jane Smith",
  poaAgentRelationship: "Spouse",
  poaSuccessorAgentName: "Michael Smith",
  poaPowers: ["Banking and finances", "Real estate", "Taxes"],

  // Healthcare Directive
  patientAdvocateName: "Jane Smith",
  patientAdvocateRelationship: "Spouse",
  successorPatientAdvocateName: "Michael Smith",
  organDonation: "Yes",
  hasHealthcareWishes: "No",
  healthcareWishesDescription: "",

  // Contingent beneficiaries
  hasContingentBeneficiary: "Yes",
  contingentBeneficiaries: [
    { name: "Emma Smith", relationship: "Daughter", share: "" },
    { name: "Liam Smith", relationship: "Son", share: "" },
  ],
  contingentEqualShares: "Yes",

  // Specific gifts
  hasSpecificGifts: "No",
  specificGiftsDescription: "",
};
