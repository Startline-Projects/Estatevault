export interface VaultItem {
  id: string;
  category: string;
  label: string;
  data: Record<string, unknown>;
  created_at: string;
  encrypted?: boolean;
  storage_path?: string | null;
}

export type FieldRule = "name" | "phone" | "email" | "digits4" | "percent" | "currency" | "alphanumeric";

export interface CategoryField {
  name: string;
  label: string;
  type: string;
  options?: string[];
  required?: boolean;
  rule?: FieldRule;
}

export const CATEGORIES = [
  { key: "estate_document", icon: "📄", label: "Estate Documents", vaultOnly: true },
  { key: "financial_account", icon: "🏦", label: "Financial Accounts", vaultOnly: true },
  { key: "insurance", icon: "🛡", label: "Insurance Policies", vaultOnly: true },
  { key: "digital_account", icon: "🔑", label: "Digital Accounts", vaultOnly: true },
  { key: "physical_location", icon: "📍", label: "Physical Locations", vaultOnly: true },
  { key: "contact", icon: "👤", label: "Important Contacts", vaultOnly: true },
  { key: "business", icon: "💼", label: "Business Interests", vaultOnly: true },
  { key: "final_wishes", icon: "📝", label: "Final Wishes", vaultOnly: true },
] as const;

export const CATEGORY_FIELDS: Record<string, CategoryField[]> = {
  financial_account: [
    { name: "label", label: "Label", type: "text", required: true },
    { name: "institution", label: "Institution name", type: "text", rule: "name" },
    { name: "account_type", label: "Account type", type: "choice", options: ["Checking", "Savings", "Investment", "Retirement", "Other"] },
    { name: "last4", label: "Last 4 digits", type: "text", rule: "digits4" },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
  insurance: [
    { name: "label", label: "Label", type: "text", required: true },
    { name: "insurance_type", label: "Insurance type", type: "choice", options: ["Life", "Long-Term Care", "Disability", "Home", "Auto", "Other"] },
    { name: "company", label: "Company name", type: "text", rule: "name" },
    { name: "policy_number", label: "Policy number", type: "text", rule: "alphanumeric" },
    { name: "coverage_amount", label: "Coverage amount", type: "text", rule: "currency" },
    { name: "beneficiary", label: "Beneficiary name", type: "text", rule: "name" },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
  digital_account: [
    { name: "label", label: "Label", type: "text", required: true },
    { name: "platform", label: "Platform/Service", type: "text", rule: "name" },
    { name: "username", label: "Username or email", type: "text" },
    { name: "password", label: "Password", type: "password" },
    { name: "memorial", label: "Memorial instructions", type: "choice", options: ["Memorialize", "Delete Account", "Transfer to someone", "No preference"] },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
  physical_location: [
    { name: "label", label: "Label", type: "text", required: true },
    { name: "location_type", label: "Location type", type: "choice", options: ["Home Safe", "Safe Deposit Box", "Attorney Office", "Filing Cabinet", "Other"] },
    { name: "description", label: "Location description", type: "text" },
    { name: "access_instructions", label: "Access instructions", type: "password" },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
  contact: [
    { name: "label", label: "Label", type: "text", required: true },
    { name: "contact_type", label: "Contact type", type: "choice", options: ["Attorney", "Financial Advisor", "CPA", "Insurance Agent", "Executor", "Healthcare Advocate", "Guardian", "Other"] },
    { name: "full_name", label: "Full name", type: "text", rule: "name" },
    { name: "firm", label: "Firm/Company", type: "text", rule: "name" },
    { name: "phone", label: "Phone", type: "text", rule: "phone" },
    { name: "email", label: "Email", type: "text", rule: "email" },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
  business: [
    { name: "label", label: "Business name", type: "text", required: true, rule: "name" },
    { name: "ownership_pct", label: "Your ownership %", type: "text", rule: "percent" },
    { name: "business_type", label: "Business type", type: "choice", options: ["LLC", "S-Corp", "Partnership", "Sole Proprietor", "Other"] },
    { name: "agreement_location", label: "Operating agreement location", type: "text" },
    { name: "co_owners", label: "Co-owner names", type: "text", rule: "name" },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
  final_wishes: [
    { name: "label", label: "Title", type: "text", required: true },
    { name: "wishes", label: "Your personal wishes and instructions", type: "textarea" },
  ],
};

export const DOC_TYPE_OPTIONS = ["Will", "Trust", "Power of Attorney", "Healthcare Directive", "Deed", "Insurance Policy", "Other"];

export type Screen = "pin-check" | "pin-create" | "pin-enter" | "vault" | "category" | "add-item" | "upload-doc" | "farewell" | "trustees";
