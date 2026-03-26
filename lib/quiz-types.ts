export interface QuizAnswers {
  state: string;
  maritalStatus: string;
  hasChildren: string;
  numberOfChildren: string;
  specialNeedsChildren: string;
  ownsRealEstate: string;
  realEstateOnlyMichigan: string;
  ownsBusiness: string;
  netWorth: string;
  privacyImportant: string;
  charitableGiving: string;
  hasExistingPlan: string;
  existingPlanAction: string;
  financeManager: string;
  medicalDecisionMaker: string;
  childGuardian: string;
  additionalSituation: string;
  worksWithAdvisor: string;
  shareWithAdvisor: boolean;
}

export const initialAnswers: QuizAnswers = {
  state: "Michigan",
  maritalStatus: "",
  hasChildren: "",
  numberOfChildren: "",
  specialNeedsChildren: "",
  ownsRealEstate: "",
  realEstateOnlyMichigan: "",
  ownsBusiness: "",
  netWorth: "",
  privacyImportant: "",
  charitableGiving: "",
  hasExistingPlan: "",
  existingPlanAction: "",
  financeManager: "",
  medicalDecisionMaker: "",
  childGuardian: "",
  additionalSituation: "",
  worksWithAdvisor: "",
  shareWithAdvisor: false,
};

export type Recommendation = "will" | "trust";

export function getRecommendation(answers: QuizAnswers): Recommendation {
  const isWill =
    answers.netWorth === "Under $150K" &&
    answers.ownsRealEstate === "No" &&
    answers.ownsBusiness === "No" &&
    answers.privacyImportant === "No";

  return isWill ? "will" : "trust";
}
