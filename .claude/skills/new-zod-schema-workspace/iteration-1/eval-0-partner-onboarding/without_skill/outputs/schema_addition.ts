import { z } from "zod";

export const partnerOnboardingStep1Schema = z.object({
  // Company information
  company_name: z.string().min(1, "Company name is required"),
  website: z.string().url("Please enter a valid URL").optional(),
  business_type: z.enum(["law_firm", "financial_advisor", "insurance", "other"]),
  years_in_business: z.number().min(0).optional(),
});

export type PartnerOnboardingStep1 = z.infer<typeof partnerOnboardingStep1Schema>;
