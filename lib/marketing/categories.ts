export const MARKETING_CATEGORIES = [
  { value: "print", label: "Print", color: "#4D714C" },
  { value: "social", label: "Social", color: "#3B5998" },
  { value: "digital", label: "Digital", color: "#1C3557" },
  { value: "email", label: "Email", color: "#C9A84C" },
  { value: "presentation", label: "Presentation", color: "#7B3F61" },
  { value: "other", label: "Other", color: "#6B7280" },
] as const;

export type MarketingCategory = (typeof MARKETING_CATEGORIES)[number]["value"];

export function categoryLabel(v: string): string {
  return MARKETING_CATEGORIES.find((c) => c.value === v)?.label || v;
}

export function categoryColor(v: string): string {
  return MARKETING_CATEGORIES.find((c) => c.value === v)?.color || "#6B7280";
}

export const SOCIAL_PLATFORMS = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "other", label: "Other" },
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]["value"];

export const ALLOWED_MIME = ["application/pdf", "image/png", "image/jpeg"];
export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25MB
