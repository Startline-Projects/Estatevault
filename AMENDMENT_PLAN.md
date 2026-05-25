# Amendment Flow — Optimized Plan

## Current Gaps
- Stripe webhook no handle `product_type: "amendment"` → payment dead-ends.
- No regen trigger post-payment.
- No link amendment→original order.
- Amendment form decoupled from specific doc (just freeform `changeType` + `description`).
- No history table.

---

## Phase 1: Data Model

**Migration:** `orders` table
```sql
ALTER TABLE orders ADD COLUMN amendment_of UUID REFERENCES orders(id);
ALTER TABLE orders ADD COLUMN amendment_diff JSONB; -- structured changes
ALTER TABLE orders ADD COLUMN amendment_version INT DEFAULT 1;
```

**New table:** `amendment_history`
- `id, order_id, parent_order_id, field_path, old_value, new_value, changed_at, document_type`

Reason: audit trail + show diff in UI.

---

## Phase 2: UX Redesign (`/dashboard/amendment`)

**Current:** dumb textarea. Bad.

**New flow — 4 steps, single page wizard:**

1. **Pick document** — list user docs (Will / Trust / POA / Healthcare). Cards with last-updated date + version badge.
2. **Pick section to amend** — structured chips not freeform:
   - Will: Executor · Beneficiaries · Guardians · Specific Bequests · Residuary
   - Trust: Trustee · Successor Trustee · Distributions · Assets
   - POA: Agent · Powers · Effective Date
   - Healthcare: Agent · Treatment Preferences
3. **Edit form** — prefill with current values from original `quiz_session.answers`. User edits only that section. Diff preview shown live (old → new strikethrough).
4. **Review + pay** — summary card: "Amending Will v1 → v2. 2 changes. $50." Stripe checkout OR free if Vault subscriber.

**Why structured beats freeform:** Claude regen needs exact fields. Freeform = hallucination risk + legal exposure.

---

## Phase 3: Backend Wiring

### 3a. Checkout (`/app/api/checkout/amendment/route.ts`)
- Accept `original_order_id`, `document_type`, `changes: {field: newValue}[]`.
- Store `amendment_diff` JSONB on new order.
- Set `amendment_of = original_order_id`.

### 3b. Stripe webhook (`/app/api/webhooks/stripe/route.ts` line 297)
Add branch:
```ts
if (productType === "amendment") {
  await queueAmendmentJob(orderId);
}
```

### 3c. Free path (Vault subscribers)
Queue job immediately after order create — skip Stripe.

### 3d. Regen worker (`/app/api/documents/process/route.ts`)
- Load parent order's `quiz_session.answers`.
- Merge `amendment_diff` → new answers object.
- Call same template `buildPrompt()` with merged answers.
- New PDF → upload to `documents/{clientId}/{newOrderId}/{docType}.pdf`.
- Mark parent doc `superseded_by = newOrderId` (soft archive, don't delete — legal retention).
- Increment `amendment_version`.

---

## Phase 4: Dashboard Surfaces

**`/dashboard/documents`:**
- Show version badge: "Will v2 · amended 2026-05-10"
- "View history" link → modal listing all versions with download + diff summary.
- Old versions: download still works, watermark "SUPERSEDED" on PDF cover page.
- New acknowledgment required before download of v2 (re-sign acknowledgment, not just reuse old).

---

## Phase 5: Notifications

- Resend email on amendment complete: "Your updated Will is ready. Sign + notarize fresh — old version void."
- If review attorney assigned to parent order → re-seal for same attorney, notify them.
- Execution guide auto-shown (signing steps differ none, but stress re-execution).

---

## Phase 6: Hard Stops (legal)

Block amendment if:
- Adds special-needs dependent → attorney referral (CLAUDE.md rule 4).
- Converts to irrevocable trust → halt.
- More than 3 amendments in 12mo → suggest full rewrite (cleaner legally).

---

## Phase 7: Edge Cases

| Case | Handle |
|------|--------|
| Payment success, regen fails | Retry queue 3x, then refund + alert admin |
| User amends mid-attorney-review | Block: "Review in progress. Wait or cancel review." |
| E2EE: user lost keys | Cannot decrypt old, but new doc seals with current pubkey — fine |
| Concurrent amendments | DB unique constraint `(amendment_of, status='pending')` — one open at a time |

---

## Build Order

1. Migration + `amendment_history` table
2. Webhook branch + worker regen logic (backend works headless)
3. Structured amendment wizard UI
4. Version history modal on dashboard
5. Email + watermark on superseded PDFs
6. Hard-stop checks

Est: 3–4 days solo dev. Phase 1+2+3 = MVP (~1.5 days). Rest = polish.
