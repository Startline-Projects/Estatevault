import { z } from "zod";

export const willIntakeSchema = z.object({
  // Personal information
  full_name: z.string().min(1, "Full name is required"),
  date_of_birth: z.string().min(1, "Date of birth is required"),
  state_of_residence: z.string().min(1, "State of residence is required"),
  marital_status: z.enum(["single", "married", "divorced", "widowed"]),
  spouse_name: z.string().optional(),

  // Children
  has_children: z.boolean(),
  children: z
    .array(
      z.object({
        name: z.string().min(1, "Child name is required"),
        date_of_birth: z.string().min(1, "Child date of birth is required"),
        is_minor: z.boolean(),
        has_special_needs: z.boolean().optional(),
      })
    )
    .optional(),

  // Executor
  executor_name: z.string().min(1, "Executor name is required"),
  executor_relationship: z.string().min(1, "Executor relationship is required"),
  alternate_executor_name: z.string().optional(),
  alternate_executor_relationship: z.string().optional(),

  // Beneficiaries
  beneficiaries: z
    .array(
      z.object({
        name: z.string().min(1, "Beneficiary name is required"),
        relationship: z.string().min(1, "Relationship is required"),
        percentage: z.number().min(0).max(100),
        contingent: z.boolean().optional(),
      })
    )
    .min(1, "At least one beneficiary is required"),

  // Guardian for minor children
  guardian_name: z.string().optional(),
  guardian_relationship: z.string().optional(),
  alternate_guardian_name: z.string().optional(),

  // Specific bequests
  specific_bequests: z
    .array(
      z.object({
        item: z.string().min(1, "Item description is required"),
        recipient: z.string().min(1, "Recipient is required"),
      })
    )
    .optional(),

  // Digital assets
  include_digital_assets: z.boolean().optional(),
  digital_asset_instructions: z.string().optional(),

  // Final wishes
  funeral_preferences: z.string().optional(),
  additional_instructions: z.string().optional(),

  // Acknowledgment
  acknowledgment_signed: z.boolean().refine((val) => val === true, {
    message: "You must sign the acknowledgment before proceeding",
  }),
});

export const trustIntakeSchema = z.object({
  // Trust type
  trust_type: z.enum(["revocable", "irrevocable"]),

  // Grantor information
  grantor_name: z.string().min(1, "Grantor name is required"),
  grantor_date_of_birth: z.string().min(1, "Date of birth is required"),
  grantor_state: z.string().min(1, "State of residence is required"),
  grantor_marital_status: z.enum(["single", "married", "divorced", "widowed"]),
  co_grantor_name: z.string().optional(),

  // Trustee
  trustee_name: z.string().min(1, "Trustee name is required"),
  trustee_relationship: z.string().min(1, "Trustee relationship is required"),
  successor_trustee_name: z.string().min(1, "Successor trustee is required"),
  successor_trustee_relationship: z.string().optional(),

  // Beneficiaries
  beneficiaries: z
    .array(
      z.object({
        name: z.string().min(1, "Beneficiary name is required"),
        relationship: z.string().min(1, "Relationship is required"),
        percentage: z.number().min(0).max(100),
        distribution_age: z.number().optional(),
        distribution_schedule: z
          .enum(["immediate", "staggered", "discretionary"])
          .optional(),
      })
    )
    .min(1, "At least one beneficiary is required"),

  // Assets to be funded into trust
  assets: z
    .array(
      z.object({
        type: z.enum([
          "real_estate",
          "bank_account",
          "investment",
          "business",
          "life_insurance",
          "personal_property",
          "other",
        ]),
        description: z.string().min(1, "Asset description is required"),
        estimated_value: z.number().optional(),
      })
    )
    .optional(),

  // Special provisions
  has_special_needs_beneficiary: z.boolean(),
  special_needs_details: z.string().optional(),
  spendthrift_clause: z.boolean().optional(),
  no_contest_clause: z.boolean().optional(),

  // Distribution instructions
  distribution_instructions: z.string().optional(),

  // Additional
  additional_provisions: z.string().optional(),

  // Acknowledgment
  acknowledgment_signed: z.boolean().refine((val) => val === true, {
    message: "You must sign the acknowledgment before proceeding",
  }),
});

export const quizAnswersSchema = z.object({
  // Personal situation
  age_range: z.enum(["18-30", "31-45", "46-60", "61+"]).optional(),
  marital_status: z
    .enum(["single", "married", "divorced", "widowed"])
    .optional(),
  has_children: z.boolean().optional(),
  has_minor_children: z.boolean().optional(),
  has_special_needs_dependent: z.boolean().optional(),

  // Assets
  owns_real_estate: z.boolean().optional(),
  has_business: z.boolean().optional(),
  estimated_estate_value: z
    .enum(["under_100k", "100k_500k", "500k_1m", "1m_5m", "over_5m"])
    .optional(),
  has_life_insurance: z.boolean().optional(),
  has_retirement_accounts: z.boolean().optional(),

  // Planning goals
  primary_concern: z
    .enum([
      "protect_family",
      "minimize_taxes",
      "avoid_probate",
      "protect_assets",
      "charitable_giving",
      "business_succession",
    ])
    .optional(),
  wants_trust: z.boolean().optional(),
  wants_attorney_review: z.boolean().optional(),
  has_existing_plan: z.boolean().optional(),

  // State
  state_of_residence: z.string().optional(),
});

export const affiliateSignupSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  acceptTerms: z.boolean().refine((v) => v === true, {
    message: "You must accept the Affiliate Agreement to continue",
  }),
});

export type WillIntake = z.infer<typeof willIntakeSchema>;
export type TrustIntake = z.infer<typeof trustIntakeSchema>;
export type QuizAnswers = z.infer<typeof quizAnswersSchema>;
export type AffiliateSignup = z.infer<typeof affiliateSignupSchema>;
