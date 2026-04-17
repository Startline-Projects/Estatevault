export const partnerOnboardingStep1Schema = z.object({
  // Company information
  company_name: z.string().min(1, "Company name is required"),
  website: z.string().optional(),

  // Business details
  business_type: z.enum(["law_firm", "financial_advisor", "insurance", "other"]),
  years_in_business: z.number().optional(),
});

export type PartnerOnboardingStep1 = z.infer<typeof partnerOnboardingStep1Schema>;
