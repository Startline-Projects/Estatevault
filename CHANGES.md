# Session Changes — 2026-05-07

## 1. Date of Birth — required indicator
**File:** `components/quiz/QuestionLabel.tsx`
- Added `required?: boolean` prop → renders red `*`.

**Files:** `app/will/page.tsx`, `app/trust/page.tsx`
- Marked First/Last name, DOB, City, Minor children with `<QuestionLabel required>`.
- DOB input gets `required` + `aria-required="true"`.

---

## 2. "Full name" → First + Last side-by-side
**File:** `components/quiz/NameInput.tsx` (new)
- Two text fields (First, Last). Stores joined `"First Last"` to keep state shape unchanged.
- `optional` prop swaps placeholders to `"First name (optional)"` etc.

**Files:** `app/will/page.tsx`, `app/trust/page.tsx`
- All `<TextInput placeholder="Full name">` swapped to `<NameInput>`:
  - Executor, Successor executor
  - Trustee, Successor trustee, Additional successors
  - Beneficiaries (primary + extras + contingent)
  - Guardian, Successor guardian
  - POA agent + successor
  - Patient advocate + successor

---

## 3. Successor Trustees — unlimited backups + relationship
**File:** `lib/trust-types.ts`
- Removed: `secondSuccessorTrusteeName: string`
- Added: `additionalSuccessorTrustees: { name: string; relationship: string }[]`

**File:** `app/trust/page.tsx`
- Trustee card now renders dynamic list of additional successors.
- Each row: NameInput + relationship tiles + `Remove` button.
- `+ Add backup successor trustee` button (unlimited).
- Review summary lists each backup with relationship.

**File:** `lib/documents/templates/michigan-revocable-trust.ts`
- Reads `additionalSuccessorTrustees`. Emits "Second Successor Trustee" + "Additional Successor Trustee 3..N".
- Legacy `secondSuccessorTrusteeName` fallback retained.

---

## 4. Beneficiaries — unlimited array (replaces primary + second)
**Files:** `lib/will-types.ts`, `lib/trust-types.ts`

**Removed fields:**
- `primaryBeneficiaryName`
- `primaryBeneficiaryRelationship`
- `hasSecondBeneficiary`
- `secondBeneficiaryName`
- `secondBeneficiaryRelationship`
- `estateSplit`
- `customSplit`

**Added:**
- `beneficiaries: { name: string; relationship: string; share: string }[]`
- `beneficiariesEqualShares: string`

**`checkComplexity` (trust):** "Unequal beneficiary split" flag now triggered by `beneficiariesEqualShares === "No"`.

**Files:** `app/will/page.tsx`, `app/trust/page.tsx`
- Beneficiary card UI:
  - Dynamic list of beneficiaries (NameInput + relationship tiles).
  - `+ Add another beneficiary` button (unlimited).
  - `Remove` button per row (idx > 0).
  - When `length > 1`: equal-shares Yes/No toggle.
  - When "No": per-row `%` input with 100% total validator (red/green status).
- Validator rewritten for array shape.
- Review summary lists each beneficiary with `— X%` or "Equal shares".

**Files:** `lib/documents/templates/michigan-will.ts`, `lib/documents/templates/michigan-revocable-trust.ts`
- Read `beneficiaries[]`, emit each with `— X%` (when custom split).
- Distribution line: "Equal shares (X% each)" or "Custom percentages".
- Legacy `primaryBeneficiaryName` fallback retained.

**Test scripts migrated to new shape:**
- `Testing Scripts/_sample-intake.ts`
- `scripts/test-will-execution-instructions.ts`
- `scripts/test-trust-banking-powers.ts`

---

## Verification
- `npx tsc --noEmit` — clean.
