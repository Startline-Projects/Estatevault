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

// ---- Vault (server-managed encryption / Option A) ----

export const VAULT_CATEGORIES = [
  "estate_document", "insurance", "financial_account", "digital_account",
  "physical_location", "contact", "final_wishes", "business",
] as const;

// Create/update a vault item (plaintext in, server encrypts at rest).
export const vaultItemSchema = z.object({
  category: z.enum(VAULT_CATEGORIES),
  label: z.string().min(1).max(500),
  data: z.record(z.string(), z.unknown()).default({}),
  storagePath: z.string().optional(),
});

// Encrypted-search query (plaintext label → server-side blind index).
export const vaultItemSearchSchema = z.object({
  label: z.string().min(1).max(500),
  category: z.string().optional(),
});

// Add a trustee. Name/email validated AFTER the route coalesces the legacy
// `trustee_*` aliases; the key win over the old hand-rolled check is `.email()`.
export const trusteeCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email("A valid email is required").max(320),
  relationship: z.string().max(200).optional(),
});

// Confirm a trustee invite via its emailed token.
export const trusteeConfirmSchema = z.object({
  token: z.string().min(1, "Missing token"),
});

// Create a farewell message (title + recipient encrypted at rest).
export const farewellCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  recipientEmail: z.string().email("A valid recipient email is required").max(320),
  storagePath: z.string().nullable().optional(),
  fileSizeMb: z.number().nullable().optional(),
  durationSeconds: z.number().nullable().optional(),
});

// Edit a farewell message. Everything but the id is optional; a supplied
// recipient email must still be a valid email.
export const farewellUpdateSchema = z.object({
  messageId: z.string().min(1, "Missing messageId"),
  title: z.string().min(1).max(500).optional(),
  recipientEmail: z.string().email("A valid recipient email is required").max(320).optional(),
  storagePath: z.string().nullable().optional(),
  fileSizeMb: z.number().nullable().optional(),
  durationSeconds: z.number().nullable().optional(),
});

// Mint a signed upload URL for opaque (client-encrypted) file content.
export const vaultUploadUrlSchema = z.object({
  kind: z.enum(["document", "farewell"]).default("document"),
  uploadId: z.string().uuid().optional(),
  expectedSize: z.number().int().positive().optional(),
});

// Mint a signed download URL for a scoped storage path.
export const vaultDownloadUrlSchema = z.object({
  bucket: z.enum(["documents", "farewell-videos"]).default("documents"),
  path: z.string().min(1),
});

export type WillIntake = z.infer<typeof willIntakeSchema>;
export type TrustIntake = z.infer<typeof trustIntakeSchema>;
export type QuizAnswers = z.infer<typeof quizAnswersSchema>;
export type AffiliateSignup = z.infer<typeof affiliateSignupSchema>;
export type VaultItemInput = z.infer<typeof vaultItemSchema>;
export type TrusteeCreateInput = z.infer<typeof trusteeCreateSchema>;
export type FarewellCreateInput = z.infer<typeof farewellCreateSchema>;
export type FarewellUpdateInput = z.infer<typeof farewellUpdateSchema>;
