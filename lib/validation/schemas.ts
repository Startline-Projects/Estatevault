import { z } from "zod";
import { validateCategoryData } from "@/lib/validation/vaultFieldRules";
import type { QuizAnswers } from "@/lib/quiz-types";
import type { WillIntake } from "@/lib/will-types";
import type { TrustIntake } from "@/lib/trust-types";

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
}).superRefine((val, ctx) => {
  // Per-field format validation (label is top-level on the client, so merge it
  // back in before validating against the category's field rules).
  const merged = { ...val.data, label: val.label };
  const errors = validateCategoryData(val.category, merged);
  for (const [field, message] of Object.entries(errors)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message,
      path: field === "label" ? ["label"] : ["data", field],
    });
  }
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

// ---- Quiz answers (server-side validation) ----

const YES_NO = z.enum(["Yes", "No"]);
const YES_NO_OR_EMPTY = z.union([z.enum(["Yes", "No"]), z.literal("")]);

export const HARD_STOP_VALUES = {
  specialNeedsChildren: "Yes" as const,
  additionalSituation: "I have a family member with special needs" as const,
};

export const quizAnswersSchema = z.object({
  state: z.enum(["Michigan", "Other"]),
  maritalStatus: z.enum(["Single", "Married", "Divorced", "Widowed"]),
  hasChildren: YES_NO,
  numberOfChildren: z.union([z.enum(["1", "2", "3", "4+"]), z.literal("")]),
  specialNeedsChildren: YES_NO_OR_EMPTY,
  ownsRealEstate: YES_NO,
  realEstateOnlyMichigan: YES_NO_OR_EMPTY,
  ownsBusiness: YES_NO,
  netWorth: z.enum(["Under $150K", "$150K to $500K", "$500K to $1M", "Over $1M"]),
  privacyImportant: YES_NO,
  charitableGiving: YES_NO,
  hasExistingPlan: YES_NO,
  existingPlanAction: z.union([z.enum(["Replace It", "Create New"]), z.literal("")]),
  financeManager: z.string().max(200),
  medicalDecisionMaker: z.string().max(200),
  childGuardian: z.string().max(200),
  additionalSituation: z.enum([
    "I own a business with partners",
    "I have a family member with special needs",
    "None of the above",
  ]),
  worksWithAdvisor: YES_NO,
  shareWithAdvisor: z.boolean(),
});

// Irrevocable trust is also a business-rule hard stop, but the platform only
// generates revocable living trusts — there is no UI path or intake field for
// irrevocable trusts, so no runtime check is needed here.
export function detectQuizHardStop(answers: z.infer<typeof quizAnswersSchema>): string | null {
  if (answers.specialNeedsChildren === HARD_STOP_VALUES.specialNeedsChildren) {
    return "special_needs_dependent";
  }
  if (answers.additionalSituation === HARD_STOP_VALUES.additionalSituation) {
    return "special_needs_family_member";
  }
  return null;
}

// ---- Checkout (Phase 3) ----

const MARITAL_STATUS = z.enum(["Single", "Married", "Divorced", "Widowed"]);
const RELATIONSHIP = z.enum(["Spouse/Partner", "Adult Child", "Sibling", "Parent", "Friend", "Other"]);
const BENEFICIARY_REL = z.enum(["Spouse/Partner", "Child", "Parent", "Sibling", "Other"]);
const CONTINGENT_REL = z.enum(["Child", "Parent", "Sibling", "Friend", "Charity/Organization", "Other"]);
const GUARDIAN_REL = z.enum(["Spouse/Partner", "Sibling", "Parent", "Friend", "Other"]);

const beneficiarySchema = z.object({
  name: z.string().min(1).max(200),
  relationship: BENEFICIARY_REL,
  share: z.string().max(10),
});

const contingentBeneficiarySchema = z.object({
  name: z.string().min(1).max(200),
  relationship: CONTINGENT_REL,
  share: z.string().max(10),
});

const RELATIONSHIP_OR_EMPTY = z.union([RELATIONSHIP, z.literal("")]);
const GUARDIAN_REL_OR_EMPTY = z.union([GUARDIAN_REL, z.literal("")]);

const willIntakeSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(50),
  maritalStatus: MARITAL_STATUS,
  hasMinorChildren: YES_NO,
  executorName: z.string().min(1).max(200),
  executorRelationship: RELATIONSHIP,
  successorExecutorName: z.string().max(200),
  successorExecutorRelationship: RELATIONSHIP_OR_EMPTY,
  beneficiaries: z.array(beneficiarySchema).min(1).max(20),
  beneficiariesEqualShares: YES_NO,
  guardianName: z.string().max(200),
  guardianRelationship: GUARDIAN_REL_OR_EMPTY,
  successorGuardianName: z.string().max(200),
  hasContingentBeneficiary: YES_NO,
  contingentBeneficiaries: z.array(contingentBeneficiarySchema).max(20),
  contingentEqualShares: z.string().max(10),
  organDonation: YES_NO,
  hasSpecificGifts: YES_NO,
  specificGiftsDescription: z.string().max(5000),
});

const TRUST_ASSET_TYPES = [
  "Primary home / real estate in Michigan",
  "Real estate in another state",
  "Bank and investment accounts",
  "Business interests",
  "Vehicles",
  "Personal property and valuables",
  "Digital assets and cryptocurrency",
] as const;

const POA_POWERS = [
  "Banking and finances",
  "Real estate transactions",
  "Business operations",
  "Tax filings",
] as const;

const trustIntakeSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(50),
  maritalStatus: MARITAL_STATUS,
  trustName: z.string().max(300),
  primaryTrustee: z.enum(["Myself", "Someone else"]),
  trusteeName: z.string().max(200),
  successorTrusteeName: z.string().min(1).max(200),
  successorTrusteeRelationship: RELATIONSHIP,
  additionalSuccessorTrustees: z.array(z.object({
    name: z.string().min(1).max(200),
    relationship: RELATIONSHIP,
  })).max(2),
  beneficiaries: z.array(beneficiarySchema).min(1).max(20),
  beneficiariesEqualShares: YES_NO,
  distributionAge: z.string().max(10),
  hasMinorChildren: YES_NO,
  guardianName: z.string().max(200),
  guardianRelationship: GUARDIAN_REL_OR_EMPTY,
  successorGuardianName: z.string().max(200),
  assetTypes: z.array(z.enum(TRUST_ASSET_TYPES)).min(1),
  executorName: z.string().min(1).max(200),
  executorRelationship: RELATIONSHIP,
  successorExecutorName: z.string().max(200),
  successorExecutorRelationship: RELATIONSHIP_OR_EMPTY,
  poaAgentName: z.string().min(1).max(200),
  poaAgentRelationship: RELATIONSHIP,
  poaSuccessorAgentName: z.string().max(200),
  poaSuccessorAgentRelationship: RELATIONSHIP_OR_EMPTY,
  poaPowers: z.array(z.enum(POA_POWERS)).min(1),
  patientAdvocateName: z.string().min(1).max(200),
  patientAdvocateRelationship: RELATIONSHIP,
  successorPatientAdvocateName: z.string().max(200),
  organDonation: YES_NO,
  hasHealthcareWishes: YES_NO,
  healthcareWishesDescription: z.string().max(5000),
  hasContingentBeneficiary: YES_NO,
  contingentBeneficiaries: z.array(contingentBeneficiarySchema).max(20),
  contingentEqualShares: z.string().max(10),
  hasSpecificGifts: YES_NO,
  specificGiftsDescription: z.string().max(5000),
});

type _QuizSchemaCheck = z.infer<typeof quizAnswersSchema> extends QuizAnswers ? true : never;
type _WillSchemaCheck = z.infer<typeof willIntakeSchema> extends WillIntake ? true : never;
type _TrustSchemaCheck = z.infer<typeof trustIntakeSchema> extends TrustIntake ? true : never;

// POST /api/checkout/will
export const willCheckoutSchema = z.object({
  userId: z.string().nullable().optional(),
  attorneyReview: z.boolean().optional().default(false),
  intakeAnswers: willIntakeSchema,
  promoCode: z.string().max(64).optional(),
  email: z.string().email().optional(),
  partnerId: z.string().nullable().optional(),
  customerEmail: z.string().email().optional(),
});

// POST /api/checkout/trust — adds trust-specific fields
export const trustCheckoutSchema = z.object({
  userId: z.string().nullable().optional(),
  attorneyReview: z.boolean().optional().default(false),
  intakeAnswers: trustIntakeSchema,
  complexityFlag: z.boolean().optional(),
  complexityReasons: z.array(z.string()).optional(),
  declinedAttorneyReview: z.boolean().optional(),
  promoCode: z.string().max(64).optional(),
  email: z.string().email().optional(),
  partnerId: z.string().nullable().optional(),
  customerEmail: z.string().email().optional(),
  confirmOverride: z.boolean().optional(),
});

// POST /api/checkout/amendment
export const amendmentCheckoutSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  changeType: z.string().min(1).max(200),
  description: z.string().min(1).max(4000),
});

// POST /api/checkout/vault-subscription — partner/guest vault signup
export const vaultSubscriptionCheckoutSchema = z.object({
  partner_slug: z.string().max(200).optional(),
  email: z.string().email().optional(),
  full_name: z.string().max(200).optional(),
});

// POST /api/checkout/partner — partner one-time platform fee
export const partnerCheckoutSchema = z.object({
  partnerId: z.string().min(1),
  tier: z.enum(["basic", "standard", "enterprise"]),
});

// POST /api/checkout/attorney — paid or promo attorney signup
export const attorneyCheckoutSchema = z.object({
  tier: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1).max(200),
  first_name: z.string().max(100).optional(),
  last_name: z.string().max(100).optional(),
  firm_name: z.string().max(200).optional(),
  bar_number: z.string().min(1).max(100),
  review_fee: z.coerce.number().nonnegative().optional(),
  practice_area: z.string().max(200).optional(),
  years_in_practice: z.union([z.string(), z.number()]).optional(),
  phone: z.string().max(50).optional(),
  password: z.string().min(8).optional(),
  promo_code: z.string().max(64).optional(),
});

// POST /api/checkout/attorney/verify — finalize paid attorney signup
export const attorneyVerifySchema = z.object({
  session_id: z.string().min(1),
  password: z.string().optional(),
});

// GET /api/checkout/verify?session_id=… — generic post-payment verification
export const checkoutVerifyQuerySchema = z.object({
  session_id: z.string().min(1),
});

// POST /api/checkout/check-conflict — plan-conflict probe
export const checkConflictSchema = z.object({
  email: z.string().email(),
  productType: z.enum(["will", "trust"]),
});

export type AffiliateSignup = z.infer<typeof affiliateSignupSchema>;
export type VaultItemInput = z.infer<typeof vaultItemSchema>;
export type TrusteeCreateInput = z.infer<typeof trusteeCreateSchema>;
export type FarewellCreateInput = z.infer<typeof farewellCreateSchema>;
export type FarewellUpdateInput = z.infer<typeof farewellUpdateSchema>;
export type WillCheckoutInput = z.infer<typeof willCheckoutSchema>;
export type TrustCheckoutInput = z.infer<typeof trustCheckoutSchema>;
export type AmendmentCheckoutInput = z.infer<typeof amendmentCheckoutSchema>;
export type PartnerCheckoutInput = z.infer<typeof partnerCheckoutSchema>;
export type AttorneyCheckoutInput = z.infer<typeof attorneyCheckoutSchema>;

// ---- Auth ----

export const authCheckEmailSchema = z.object({
  email: z.string().email(),
});

export const authCheckVerificationSchema = z.object({
  email: z.string().email(),
  sessionId: z.string().min(1),
});

export const authHandoffSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  target: z.enum(["client", "partner", "admin", "sales"]),
  redirect_path: z.string().startsWith("/"),
});

export const authHandoffConsumeSchema = z.object({
  token: z.string().min(1),
});

export const authExchangeResetTokenSchema = z.object({
  token_hash: z.string().min(1),
});

export const authRecoverySchema = z.object({
  email: z.string().email(),
});

export const authResendVerificationSchema = z.object({
  email: z.string().email(),
});

export const authSendVerifyCodeSchema = z.object({
  email: z.string().email(),
  partnerSlug: z.string().optional(),
  partnerId: z.string().optional(),
});

export const authSendVerifyLinkSchema = z.object({
  email: z.string().email(),
  sessionId: z.string().min(16),
  partnerSlug: z.string().optional(),
  partnerId: z.string().optional(),
});

export const authSetPasswordSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().optional(),
  verifiedToken: z.string().min(1),
});

export const authSignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().optional(),
  verifiedToken: z.string().min(1),
  partnerSlug: z.string().optional(),
});

export const authVerifyCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().min(1),
});

// ---- Farewell / Trustee ----

export const farewellAccessSchema = z.object({
  clientId: z.string().min(1),
  trusteeEmail: z.string().email(),
});

export const farewellOwnerVetoSchema = z.object({
  token: z.string().min(1),
});

export const trusteeUnlockOtpSchema = z.object({
  token: z.string().min(1),
});

export const trusteeUnlockVerifySchema = z.object({
  token: z.string().min(1),
  code: z.string().regex(/^\d{6}$/),
});

// ---- Attorney ----

export const attorneyApproveSchema = z.object({
  reviewId: z.string().min(1),
});

export const attorneyNotifyClientSchema = z.object({
  reviewId: z.string().min(1),
});

// ---- Admin ----

export const adminFarewellVerificationSchema = z.object({
  requestId: z.string().min(1),
  action: z.enum(["approve", "reject"]),
  notes: z.string().optional(),
});

export const adminTestPromoSchema = z.object({
  active: z.boolean(),
});

// ---- Partner ----

export const partnerAddDomainSchema = z.object({
  businessUrl: z.string().min(1),
  domainType: z.string().optional(),
});

export const partnerClientsCreateSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  email: z.string().email(),
  partnerId: z.string().min(1),
  action: z.string().optional(),
});

export const partnerClientsUpdateSchema = z.object({
  clientId: z.string().min(1),
  partnerId: z.string().min(1),
  note: z.string().min(1),
});

export const partnerEmailSetupSchema = z.object({
  sender_name: z.string().min(1),
  sender_email: z.string().email(),
});

export const partnerVaultClientCheckoutSchema = z.object({
  clientEmail: z.string().email(),
  clientName: z.string().min(1),
  tempPassword: z.string().min(1),
  pin: z.string().regex(/^\d{6}$/),
});

export const partnerVaultSubdomainSchema = z.object({
  partnerId: z.string().min(1),
  subdomain: z.string().regex(/^[a-z0-9][a-z0-9-]{1,50}[a-z0-9]$/),
});

export const createReviewAttorneySchema = z.object({
  partnerId: z.string().min(1),
  attorneyEmail: z.string().email(),
  attorneyName: z.string().optional(),
  barNumber: z.string().optional(),
});

// ---- Sales ----

export const salesAffiliateStatusSchema = z.object({
  status: z.enum(["active", "suspended"]),
});

export const salesCreatePartnerSchema = z.object({
  companyName: z.string().min(1),
  ownerName: z.string().min(1),
  email: z.string().email(),
  businessUrl: z.string().optional(),
  phone: z.string().optional(),
  state: z.string().optional(),
  professionalType: z.string().optional(),
  tier: z.enum(["basic", "standard", "enterprise"]).optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
  promoCode: z.string().max(64).optional(),
  partnerRevenuePct: z.number().min(0).max(100).optional(),
});

export const salesCreateRepSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  commissionRate: z.number().min(0).max(100),
});

export const salesPartnerNotesSchema = z.object({
  partnerId: z.string().min(1),
  note: z.string().min(1).max(5000),
});

export const salesRepsUpdateSchema = z.object({
  repId: z.string().min(1),
  commissionRate: z.number().min(0).max(100),
});

export const salesSendWelcomeEmailSchema = z.object({
  email: z.string().email(),
  tempPassword: z.string().min(1),
  ownerName: z.string().optional(),
  companyName: z.string().optional(),
});

// ---- Documents ----

export const documentGenerateSchema = z.object({
  order_id: z.string().min(1),
});

// ---- Other ----

export const contactSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  message: z.string().min(1).max(5000),
});

export const emailPartnerActivatedSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
});

export const professionalRequestAccessSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  professionalType: z.string().min(1),
  phone: z.string().optional(),
  companyName: z.string().optional(),
  clientCount: z.union([z.string(), z.number()]).optional(),
  referralSource: z.string().optional(),
  bar_number: z.string().optional(),
  practice_areas: z.union([z.string(), z.array(z.string())]).optional(),
  desired_review_fee: z.number().optional(),
});

export const quizPersonalizeSchema = z.object({
  quiz_answers: quizAnswersSchema,
  recommendation: z.enum(["will", "trust"]),
});

export const farewellUploadCompleteSchema = z.object({
  messageId: z.string().min(1),
  storagePath: z.string().min(1),
  fileSize: z.number().nonnegative().max(524288000).optional(),
  duration: z.number().nonnegative().max(1800).optional(),
});

export const vaultPinSchema = z.object({
  action: z.enum(["check", "create", "verify", "change"]),
  pin: z.string().regex(/^\d{6}$/).optional(),
  newPin: z.string().regex(/^\d{6}$/).optional(),
});

export const stripeConnectOnboardSchema = z.object({
  returnPath: z.string().startsWith("/").optional(),
});

// ---- Inline schema consolidation (from crypto/share/backfill routes) ----

export const pubkeyQuerySchema = z
  .object({
    email: z.string().email().optional(),
    userId: z.string().uuid().optional(),
  })
  .refine((v) => !!(v.email || v.userId), {
    message: "email or userId required",
  });

export const shareCreateSchema = z.object({
  itemId: z.string().uuid(),
  recipientUserId: z.string().uuid(),
  wrappedDek: z.string().min(1),
  senderPubkey: z.string().min(1),
  encVersion: z.number().int().optional(),
});

export const backfillRowSchema = z.object({
  id: z.string().uuid(),
  ciphertext: z.string().min(1),
  nonce: z.string().min(1),
  encVersion: z.number().int().optional(),
  labelBlind: z.string().optional(),
  emailBlind: z.string().optional(),
  recipientBlind: z.string().optional(),
});

export const backfillEncryptSchema = z.object({
  table: z.enum(["vault_items", "vault_trustees", "farewell_messages"]),
  rows: z.array(backfillRowSchema).min(1).max(100),
});

export const backfillFetchQuerySchema = z.object({
  table: z.enum(["vault_items", "vault_trustees", "farewell_messages"]),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// B2: attorney moves a review's status (pipeline drag/drop).
export const attorneyReviewStatusSchema = z.object({
  status: z.string().min(1).max(40),
});

// B2: sales pipeline prospect CRUD.
export const salesProspectCreateSchema = z.object({
  company_name: z.string().min(1).max(200),
  contact_name: z.string().max(200).optional().nullable(),
  email: z.string().max(200).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  professional_type: z.string().max(80).optional().nullable(),
  source: z.string().max(120).optional().nullable(),
});

export const salesProspectUpdateSchema = z.object({
  company_name: z.string().min(1).max(200).optional(),
  contact_name: z.string().max(200).optional().nullable(),
  email: z.string().max(200).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  professional_type: z.string().max(80).optional().nullable(),
  source: z.string().max(120).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  stage: z.string().max(40).optional(),
  last_contacted_at: z.string().optional().nullable(),
  next_action_at: z.string().optional().nullable(),
});

export const salesProspectActivitySchema = z.object({
  type: z.string().min(1).max(40),
  body: z.string().max(5000).optional().nullable(),
});

// B2: partner self-update of onboarding fields (NON-financial — payment flags
// like one_time_fee_paid are excluded; those stay server/webhook-controlled).
export const partnerSelfUpdateSchema = z.object({
  onboarding_step: z.number().int().min(1).max(8).optional(),
  onboarding_completed: z.boolean().optional(),
  status: z.enum(["onboarding", "active", "suspended", "cancelled"]).optional(),
  professional_type: z.string().max(80).optional(),
  has_inhouse_estate_attorney: z.boolean().optional(),
  inhouse_review_attorney_id: z.string().uuid().optional().nullable(),
  business_url: z.string().max(255).optional(),
  partner_slug: z.string().max(120).optional(),
  // Branding (non-financial, partner-owned presentation fields).
  company_name: z.string().max(200).optional(),
  product_name: z.string().max(200).optional(),
  accent_color: z.string().max(40).optional(),
  logo_url: z.string().max(2048).optional().nullable(),
  theme_preset: z.string().max(80).optional(),
  hero_recipe: z.string().max(80).optional(),
  highlight_dark: z.string().max(40).optional().nullable(),
  highlight_light: z.string().max(40).optional().nullable(),
  cta_text_override: z.string().max(120).optional().nullable(),
  landing_text_color: z.string().max(40).optional(),
  // Email sender identity + vault presentation (non-financial).
  sender_name: z.string().max(200).optional(),
  sender_email: z.string().email().max(255).optional(),
  vault_tagline: z.string().max(255).optional().nullable(),
  vault_theme: z.enum(["light", "dark"]).optional(),
  // Attorney-partner's own in-house review fee (they keep 100%); cents.
  custom_review_fee: z.number().int().min(0).max(100000).optional().nullable(),
});

// A user updating their own profile display name (B2 settings).
export const profileSelfUpdateSchema = z.object({
  full_name: z.string().min(1).max(200),
});

// A sales rep toggling a managed partner's account status (B2 partner-detail).
export const salesPartnerStatusSchema = z.object({
  status: z.enum(["active", "suspended"]),
});

// A sales rep applying a promo code to a managed partner (comps platform fee).
export const salesApplyPromoSchema = z.object({
  promo_code: z.string().min(1).max(40),
});

// A sales rep marking a professional lead's status (B2 sales dashboard).
export const salesLeadStatusSchema = z.object({
  status: z.enum(["new", "contacted"]),
});

// A sales rep / admin acting on a pending attorney bar-verification (B2).
export const attorneyVerificationSchema = z.object({
  partnerId: z.string().uuid(),
  action: z.enum(["activate", "reject"]),
});

// A client toggling their trust funding checklist (B2). Map of asset -> done.
export const fundingChecklistSchema = z.object({
  checklist: z.record(z.string().max(200), z.boolean()),
});

// A client updating their own profile contact + notification prefs (B2 settings).
export const clientProfileUpdateSchema = z.object({
  full_name: z.string().max(200).optional(),
  phone: z.string().max(40).optional().nullable(),
  notification_preferences: z.record(z.string().max(80), z.boolean()).optional(),
});

// A client updating their advisor-sharing settings (B2 settings).
export const clientAdvisorUpdateSchema = z.object({
  advisor_name: z.string().max(200).optional().nullable(),
  advisor_firm: z.string().max(200).optional().nullable(),
  advisor_share_consent: z.boolean().optional(),
});

// A partner queuing a pre-launch client invite during onboarding (B2).
export const waitlistInviteSchema = z.object({
  client_email: z.string().email(),
});
