// Shared vault field validation — single source of truth for BOTH the client
// form (components/vault/VaultAddItemForm.tsx) and the server schema
// (lib/validation/schemas.ts). Moderate strictness: block obvious garbage
// (pure-number names, malformed phone/amount) without rejecting valid intl input.

import { CATEGORY_FIELDS, type FieldRule } from "@/components/vault/vault-constants";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const countDigits = (v: string) => (v.match(/\d/g)?.length ?? 0);

const RULES: Record<FieldRule, { test: (v: string) => boolean; message: string }> = {
  name: {
    test: (v) => /[A-Za-z]/.test(v) && v.trim().length >= 2 && v.length <= 200,
    message: "Enter a valid name (must include letters).",
  },
  phone: {
    test: (v) => /^[\d\s()+.\-]{7,20}$/.test(v) && countDigits(v) >= 7,
    message: "Enter a valid phone number.",
  },
  email: {
    test: (v) => EMAIL_REGEX.test(v),
    message: "Enter a valid email address.",
  },
  digits4: {
    test: (v) => /^\d{4}$/.test(v),
    message: "Must be exactly 4 digits.",
  },
  percent: {
    test: (v) => {
      const n = Number(v);
      return !Number.isNaN(n) && n >= 0 && n <= 100;
    },
    message: "Enter a number between 0 and 100.",
  },
  currency: {
    test: (v) => /^\$?[\d,]+(\.\d{1,2})?$/.test(v.trim()) && Number(v.replace(/[$,]/g, "")) > 0,
    message: "Enter a valid amount.",
  },
  alphanumeric: {
    test: (v) => /^[A-Za-z0-9\s\-]+$/.test(v),
    message: "Use letters and numbers only.",
  },
};

// Validate one field. Empty value → required ? error : null. No rule → null.
export function validateField(
  rule: FieldRule | undefined,
  value: string | undefined,
  required = false,
): string | null {
  const v = (value ?? "").trim();
  if (!v) return required ? "This field is required." : null;
  if (!rule) return null;
  return RULES[rule].test(v) ? null : RULES[rule].message;
}

// Validate a full category data blob → { fieldName: errorMsg } (empty = valid).
export function validateCategoryData(
  category: string,
  data: Record<string, unknown>,
): Record<string, string> {
  const fields = CATEGORY_FIELDS[category] ?? [];
  const errors: Record<string, string> = {};
  for (const f of fields) {
    const raw = data[f.name];
    const err = validateField(f.rule, raw == null ? "" : String(raw), f.required);
    if (err) errors[f.name] = err;
  }
  return errors;
}
