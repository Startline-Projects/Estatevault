# EstateVault — Complete User Flows Reference

> **Purpose:** Single source of truth for all user flows. Reference during refactoring.
> **Last updated:** 2026-05-27

---

## Table of Contents

1. [User Roles & Portal Routing](#1-user-roles--portal-routing)
2. [Authentication Flows](#2-authentication-flows)
3. [Client Flows](#3-client-flows)
4. [Document Lifecycle](#4-document-lifecycle)
5. [Vault System](#5-vault-system)
6. [Farewell & Trustee Access](#6-farewell--trustee-access)
7. [Checkout & Payments](#7-checkout--payments)
8. [Attorney Flows](#8-attorney-flows)
9. [Partner / White-Label Flows](#9-partner--white-label-flows)
10. [Affiliate Flows](#10-affiliate-flows)
11. [Admin / Sales Flows](#11-admin--sales-flows)
12. [Cron Jobs & Automated Emails](#12-cron-jobs--automated-emails)
13. [Pricing & Revenue Splits](#13-pricing--revenue-splits)
14. [API Endpoint Catalog](#14-api-endpoint-catalog)

---

## 1. User Roles & Portal Routing

### User Types
```
client | partner | sales_rep | admin | attorney | affiliate | review_attorney
```
Stored in `profiles.user_type` (source of truth) and `auth.user.user_metadata.user_type`.

### Host-Based Portal Isolation (Middleware)

| Host | Portal | Allowed Roles |
|------|--------|---------------|
| `estatevault.us` / `www.estatevault.us` / `localhost:3000` | Client | client |
| `pro.estatevault.us` | Partner | partner |
| `admin.estatevault.us` | Admin | admin |
| `sales.estatevault.us` | Sales | sales_rep |
| `{subdomain}.estatevault.us` | White-label | client (partner-scoped) |
| `{custom_domain}` | White-label | client (partner-scoped) |

**File:** `/lib/supabase/middleware.ts`

### Post-Login Redirects

| User Type | Condition | Redirect |
|-----------|-----------|----------|
| client | default | `/dashboard` |
| partner | `onboarding_completed = false` | `/pro/onboarding/step-1` |
| partner | `status = "pending_verification"` | `/partners/attorneys/welcome` |
| partner | active | `/pro/dashboard` |
| sales_rep | — | `/sales/dashboard` |
| admin | — | `/sales/dashboard` |
| review_attorney | — | `/attorney` |
| affiliate | — | `/affiliate` |

### Public Paths (No Auth)
`/`, `/quiz`, `/will`, `/trust`, `/auth/*`, `/professionals`, `/farewell/*`, `/contact`, `/a/{code}`, `/api/auth/*`, `/api/checkout/*`, `/api/affiliate/*`

---

## 2. Authentication Flows

### 2.1 Client Sign-Up
**Entry:** `/auth/signup?partner={slug}&redirect={path}`

```
1. Enter email → "Verify Email"
2. POST /api/auth/send-verify-code → 6-digit code via Resend
3. Enter code → POST /api/auth/verify-code → returns token
4. Enter full name + password (min 8 chars)
5. POST /api/auth/signup (with verified token)
   → Creates auth.users + profiles (user_type: "client") + clients
   → If partner_slug: links client to partner
   → Sends welcome email
6. Auto sign-in via supabase.auth.signInWithPassword()
7. Redirect:
   - Vault flow (partner + vault in redirect): POST /api/checkout/vault-subscription → Stripe
   - Normal: /dashboard or redirect param
```

**Files:** `/app/auth/signup/page.tsx`, `/app/api/auth/signup/route.ts`, `/app/api/auth/send-verify-code/route.ts`, `/app/api/auth/verify-code/route.ts`

### 2.2 Client Login
**Entry:** `/auth/login?redirect={path}&email={optional}`

```
1. Enter email + password → supabase.auth.signInWithPassword()
2. Fetch profile → determine user_type
3. Host validation:
   - Partner-scoped client must login from partner's whitelabel host
   - Wrong host → sign out + error with correct portal URL
   - localhost bypasses check
4. Role-based redirect (see table above)
```

**Cross-Domain Handoff** (when user lands on wrong host):
```
1. POST /api/auth/handoff → encrypts session tokens
2. Redirect to target host: /auth/handoff?t={encrypted_token}
3. POST /api/auth/handoff/consume → decrypts, sets session
4. User authenticated on target host
```

**Files:** `/app/auth/login/page.tsx`, `/app/auth/handoff/page.tsx`, `/app/api/auth/handoff/route.ts`, `/app/api/auth/handoff/consume/route.ts`

### 2.3 Forgot / Reset Password
**Entry:** `/auth/forgot-password`

```
1. Enter email → POST /api/auth/recovery
   → supabase.auth.admin.generateLink(type: "recovery")
   → Email via Resend (does NOT leak account existence)
2. Click link → /auth/reset-password?token_hash={hash}&type=recovery
3. supabase.auth.verifyOtp(token_hash, type: "recovery")
4. Enter new password → supabase.auth.updateUser({ password })
5. Role-based redirect
```

**Files:** `/app/auth/forgot-password/page.tsx`, `/app/auth/reset-password/page.tsx`, `/app/api/auth/recovery/route.ts`

### 2.4 Email Verification
**Code-based (current):**
- POST `/api/auth/send-verify-code` → 6-digit code to email
- POST `/api/auth/verify-code` → returns token for signup

**Link-based (fallback):**
- GET `/api/auth/verify-link?token={token}&email={email}` → renders HTML verify button
- POST same route → consumes one-time token

**Resend verification:** POST `/api/auth/resend-verification` (rate limit: 1/60s per email)

### 2.5 Guest Checkout → Account Creation
```
1. Guest completes Stripe checkout (email captured)
2. Webhook fires → POST /api/auth/set-password
   → Creates auth user + profile + links to client/order by email
   → Handles race condition (webhook before HTTP response)
3. User receives email with password-set link
4. User signs in with chosen password
```

---

## 3. Client Flows

### 3.1 Dashboard Home
**Entry:** `/dashboard`

**Renders:**
- Welcome banner (first name)
- Completion ring: % based on (docs purchased + vault populated + assets funded)
- Next action card with dynamic CTA
- Package status card (polls for generation/delivery)
- Annual review banner (if account 12+ months old)

**Vault-Only Lockout:** If `vault_subscription_status = "active"` AND no estate plan order → only `/dashboard/vault` and `/dashboard/settings` accessible.

### 3.2 Quiz → Recommendation
**Entry:** `/quiz`

```
Module A: State (Michigan only) + marital status
Module B: Children (if yes → special needs?)
Module C: Real estate + business + net worth
Module D: Privacy importance + charitable intentions
Module E: Existing plan check
Module F: Key decision makers (finance, medical, guardian)
Module G: Additional situations (special needs, business partners)
```

**Hard stops:** Special needs children/family, out-of-state residents.

**Recommendation logic (`getRecommendation()`):**
- **Will**: Under $150K + no real estate + no business + privacy not important
- **Trust**: Everything else (default)

**Output:** Direct to `/will` or `/trust` product page.

**Storage:** `quiz_sessions.answers` (JSONB)

### 3.3 Will Intake (7 cards)
**Entry:** `/will`

| Card | Fields |
|------|--------|
| Residency | Michigan residency + marital status |
| About You | Name, DOB (18+), city, minor children |
| Executor | Primary + successor executor (name + relationship) |
| Beneficiaries | Dynamic list: names, relationships, equal/custom shares, contingent beneficiaries |
| Guardian | (if minor children) Primary + successor guardian |
| Gifts | Organ donation + specific gifts/bequests |
| Review | Expandable summary with inline edit |

Answers stored in sessionStorage during intake → sent to `/api/checkout/will` on submit.

### 3.4 Trust Intake
Same structure as Will with additional trust-specific fields (trustee appointment, asset funding, etc.).

### 3.5 Life Events
**Entry:** `/dashboard/life-events`

8 events with urgent flags:
- Married, Divorced, New child, Bought property, Started business, Loss of beneficiary, Health diagnosis, Asset changes

**Actions:** Select events → "Review My Options" → each shows recommendation + action button (amendment $50 or attorney referral).

### 3.6 Funding Checklist (Trust clients only)
**Entry:** `/dashboard/funding-checklist`

Dynamically populated from quiz answers. Per asset type:
- Checkbox + label + instructions
- Learn more → expanded details
- All checked → celebration message

Assets: primary home, out-of-state real estate, bank/investment accounts, business interests, vehicles, personal property, digital assets/crypto.

### 3.7 Amendment Flow
**Entry:** `/dashboard/amendment`

```
1. Select change type: beneficiary, executor/trustee, guardian, personal info, add assets, other
2. Describe changes (textarea)
3. Submit:
   - Subscriber (vault active): POST /api/checkout/amendment → free, redirect /dashboard/documents?amended=true
   - Non-subscriber: POST /api/checkout/amendment → Stripe checkout ($50)
```

### 3.8 Settings
**Entry:** `/dashboard/settings` (accordion sections)

| Section | Fields |
|---------|--------|
| Account | Full name, email (read-only), phone, change password |
| Vault PIN | Change 6-digit PIN (current + new + confirm) |
| Notifications | 3 toggles: doc delivery, annual review, life event reminders |
| Linked Advisor | Advisor name, firm name, consent checkbox |

---

## 4. Document Lifecycle

### 4.1 Status Flow
```
pending → paid → generating → delivered
                      ↓
                    review → delivered
                    (if attorney_review_requested)
```

### 4.2 Generation Pipeline
**Trigger:** Checkout completion → order status = "paid" → "generating"

```
1. POST /api/documents/generate → adds job to Redis queue
2. GET /api/documents/process (cron/worker) picks up job
3. Per document type:
   a. Fetch template: /lib/documents/templates/{state}-{doctype}.ts
   b. Build prompt via template.buildPrompt(intake)
   c. Claude API call (Opus 4, 8K-16K tokens)
   d. Generate PDF via generatePDF()
   e. Generate DOCX if attorney review (non-fatal if fails)
   f. Upload to storage: {clientId}/{orderId}/{documentType}.pdf
4. Status updates: pending → generated → delivered (or review)
5. Quiz answers purged from DB (E2EE compliance)
6. Client email notification sent
```

**Document types per product:**
- **Will:** [will, poa, healthcare_directive]
- **Trust:** [trust, pour_over_will, poa, healthcare_directive]

### 4.3 Template System
**Location:** `/lib/documents/templates/{state}-{doctype}.ts`

Each template exports:
- `{docType}SystemPrompt` — attorney-approved constraints + Michigan MCL references
- `build{DocType}Prompt(intake)` — converts intake to legal document language

Templates: `michigan-will.ts`, `michigan-trust.ts`, `michigan-pour-over-will.ts`, `michigan-poa.ts`, `michigan-healthcare-directive.ts`

### 4.4 Document Viewing / Downloading
**Entry:** `/dashboard/documents`

**Polling:**
- Generating: every 4s
- Attorney review: every 12s
- Stops when delivered or unmount
- Resumes on tab focus

**Download:** GET `/api/documents/download?id={documentId}`
- Auth: client owner, partner, admin, or review attorney
- If attorney reviewed: returns `reviewed_path` (edited PDF)
- If E2EE sealed: unseals for user

**Execution guides:** Modal per doc type with Michigan-specific signing requirements:
- Will: 2 witnesses + optional notary
- Trust: notarization required
- POA: notarization required
- Healthcare Directive: 2 witnesses (not POA/healthcare providers)

### 4.5 Signing (Offline)
No built-in e-signatures. Users sign offline then mark executed:
```
POST /api/client/mark-executed
→ clients.documents_executed = true
→ clients.documents_executed_at = now
→ Audit log + email confirmation
```

---

## 5. Vault System

### 5.1 PIN Protection
**Entry:** `/dashboard/vault`

```
First visit → Create 6-digit PIN (confirmation required)
Subsequent → Enter PIN (auto-lock after 10 min inactivity)
Session: stored in sessionStorage (expires on tab close)
```

**API:** POST `/api/vault/pin` (actions: create, check, change)

### 5.2 Vault Categories (8)
| Category | Description |
|----------|-------------|
| estate_document | PDFs from orders |
| financial_account | Bank/investment (masked acct #) |
| insurance | Policy info |
| digital_account | Passwords + memorial instructions |
| physical_location | Safe deposit boxes, offices |
| contact | Attorney, CPA, executor contacts |
| final_wishes | Video messages, burial instructions |
| business | Business interests, ownership % |

**Gating:** Categories locked until vault subscription ($99/year) purchased.

### 5.3 E2E Encryption Architecture

**Layer 1 — Per-User DEK:**
- Generated during E2EE bootstrap: `/api/crypto/bootstrap`
- Wrapped with user passphrase: `/api/crypto/bundle`
- Stored in `clients.wrapped_dek` (bytea)

**Layer 2 — Sub-Key Derivation:**
- Master DEK → HKDF-SHA256 → DB key + Index key
- Zero'd after use

**Layer 3 — Item Encryption:**
- Algorithm: XChaCha20-Poly1305 (format: EV01)
- Payload: JSON {label, data}
- Stored: ciphertext (bytea) + nonce (bytea) + enc_version

### 5.4 Vault Item Operations
**API:** `/api/vault/items` (GET/POST/PATCH/DELETE)

- `listItems()` → filters out order-generated docs
- `createItem()` → encrypt in browser → store
- `deleteItem()` → remove from vault
- `uploadDocument()` → encrypt → upload (PDF, max 20MB)
- `downloadDocument()` → decrypt in browser → download

### 5.5 Sharing Vault Items
**API:** `/api/share` (GET/POST/DELETE)

```
CREATE: Owner wraps DEK via crypto_box_seal → POST with itemId, recipientUserId, wrappedDek, senderPubkey
  → Validates item ownership + recipient has E2EE bootstrap
  → Upserts into item_shares

RETRIEVE: direction=in (shared TO me) or direction=out (shared BY me)

REVOKE: DELETE → sets revoked_at → recipient can no longer decrypt
```

---

## 6. Farewell & Trustee Access

### 6.1 Farewell Messages (Owner Side)
**Entry:** `/dashboard/vault/farewell` (requires vault subscription)

```
1. Create message: title + recipient email
2. Record via webcam OR upload video (MP4/MOV/WebM, max 500MB)
3. Preview recorded video
4. Status: locked → pending_verification → unlocked
```

### 6.2 Trustee Management
**Entry:** `/dashboard/vault/trustees`

- Max 2 trustees
- Fields: name, email, relationship
- Granular scope: farewell toggle, documents toggle, 8 category checkboxes
- Confirmation email sent to trustee
- Status: Pending → Confirmed

**Shamir Secret Sharing:** `/dashboard/vault/trustees/init` — E2EE key recovery setup

### 6.3 Trustee Access Flow (Public)
**Entry:** `/farewell/{clientId}`

```
Step 1: "Submit death certificate" → upload (PDF/JPG/PNG, max 10MB) + trustee email
  → POST /api/farewell/verify

Step 2: Admin reviews within 24-48 hours

Step 3: 72-hour owner-veto window starts
  - During window: trustee sees plaintext docs + farewell metadata, encrypted vault locked
  - After window: one-time unlock link emailed (valid 7 days)

Step 4: Trustee enters email → POST /api/farewell/access
  → email_sent: check email for 7-day sign-in link
  → unlocked: view farewell messages + documents + vault categories
  → pending_approval/pending: wait screen
  → blocked: error with reason

Step 5: Full access view:
  - Farewell messages (play buttons)
  - Downloadable documents
  - Encrypted vault items (category counts + E2EE badge)
```

---

## 7. Checkout & Payments

### 7.1 Will Checkout
**API:** POST `/api/checkout/will`

```
1. Validate intake via willCheckoutSchema
2. Check promo:
   - FREE134 → $0 order, auto-create account, generate docs immediately
   - TEST → $0 test order (24h expiry, demo, estatevault.us only, max 50/hr)
   - None → paid Stripe flow
3. Conflict check: no duplicate will in last 2 years
4. Get/create client record
5. Create order: product_type "will", amount_total $400 (+$300 if attorney review)
6. Save intake to quiz_sessions
7. Create Stripe checkout session (mode: "payment")
   - Success: /will/success?session_id={id}
   - Cancel: /will/checkout
   - Metadata: order_id, client_id, partner_id, affiliate_id, attorney_review
8. Update order with stripe_session_id
```

### 7.2 Trust Checkout
**API:** POST `/api/checkout/trust`

Same as Will except: price $600, generates [trust, pour_over_will, poa, healthcare_directive].

### 7.3 Amendment Checkout
**API:** POST `/api/checkout/amendment`

```
- Subscriber: free ($0), order created, redirect to /dashboard/documents
- Non-subscriber: $50 Stripe checkout
- Input: changeType + description (max 100 chars)
```

### 7.4 Vault Subscription Checkout
**API:** POST `/api/checkout/vault-subscription`

```
- Price: $99/year (Stripe subscription, recurring)
- Guest email signup allowed
- Creates auth + profile + client before Stripe session
- Success: /dashboard/vault?subscribed=true OR /{partner_slug}/vault?subscribed=true
- Post-payment: redirect to /auth/vault-pin for PIN setup
- Partner revenue split via application_fee_percent
```

### 7.5 Stripe Webhook Handler
**API:** POST `/api/webhooks/stripe`

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Create order, update partner fees, link affiliate, send welcome email, queue doc generation |
| `invoice.payment_succeeded` | Renewal: update vault status to "active", extend expiry +1yr |
| `invoice.payment_failed` | Set "past_due", send dunning email |
| `customer.subscription.deleted` | Set "cancelled", clear subscription ID |

### 7.6 Subscription Management
- **Status:** GET `/api/subscription/status` → active/past_due/cancelled/none + permissions (canAmendFree, canUseFarewell)
- **Sync:** POST `/api/subscription/sync` → reconcile DB with Stripe (handles missed webhooks)
- **Cancel:** POST `/api/subscription/cancel` → `cancel_at_period_end: true` (access until renewal)

---

## 8. Attorney Flows

### 8.1 Attorney Partner Signup
**Entry:** `/partners/attorneys/signup?tier={standard|professional}&promo={TPFP}`

**3 Steps:**
1. **Details:** Name, email, phone, firm, bar number, years in practice, practice area, password
2. **Review Fee:** Set custom fee ($150-$1,500), live earnings preview
3. **Payment:**
   - Promo TPFP → free, creates account + partner immediately, status "pending_verification"
   - Paid → Stripe checkout: Standard $1,200 / Professional $6,000

**API:** POST `/api/checkout/attorney`

**Post-signup:** Redirects to `/partners/attorneys/welcome`. Admin must verify bar number.

### 8.2 Attorney Review Process
```
1. Client orders will/trust with attorney review (+$300)
2. Webhook creates attorney_reviews record:
   - status: "pending", sla_deadline: now + 96 hours
   - Routing: inhouse attorney vs Mo Murshed (W-2) vs Review Network (future)

3. Attorney portal: /attorney/dashboard
   - GET /api/attorney/review?id={reviewId} → review details + documents
   - View original PDF + editable DOCX

4. POST /api/attorney/upload-reviewed → upload corrected DOCX
   - Server converts DOCX → PDF
   - Sealed to client's X25519 pubkey (if available)
   - Stored: {clientId}/{orderId}/{docType}.reviewed.pdf

5. POST /api/attorney/approve → decision: approved | approved_with_notes | flagged
   - If approved: order → "delivered", documents → "delivered"
   - Client email with reviewed PDF
```

**Review Routing Logic** (`/lib/attorney-review/routing.ts`):
- Partner `has_inhouse_estate_attorney: true` → route to partner's attorney
- Otherwise → Mo Murshed (EstateVault employee)
- Review fee: partner in-house → Stripe Connect to partner, Mo → no transfer

### 8.3 Attorney API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/attorney/review` | GET | Fetch review details + documents |
| `/api/attorney/approve` | POST | Submit decision |
| `/api/attorney/upload-reviewed` | POST | Upload corrected DOCX |
| `/api/attorney/review-docx` | GET | Get editable DOCX |
| `/api/attorney/check-sla` | POST | Check SLA deadline |
| `/api/attorney/notify-client` | POST | Send message to client |

---

## 9. Partner / White-Label Flows

### 9.1 Partner Onboarding
**Entry:** Admin creates partner OR self-signup

**Steps:**
1. **Choose Plan:** Basic $500 / Standard $1,200 / Enterprise $6,000 → Stripe checkout (or FREE676 promo)
2. **Brand Platform:** Upload logo, set company name, accent color, theme preset, hero recipe, custom gradient
3. **Domain Setup:** Custom domain, subdomain
4. **Email Config:** Custom sender email, verify ownership
5-7. Team seats, integrations, etc.

**Files:** `/app/pro/onboarding/step-{1-7}/page.tsx`

### 9.2 White-Label Resolution (Middleware)
```
Request hits {custom_domain} or {subdomain}.estatevault.us
  → Middleware matches against partners table (custom_domain, subdomain, vault_subdomain)
  → Rewrites to /{partner_slug} with headers: x-partner-slug, x-partner-hostname, x-is-vault-subdomain
  → Page renders with partner branding (logo, colors, theme, hero)
```

### 9.3 Partner Dashboard
**Entry:** `/pro/dashboard`

- Revenue tracking: MTD, YTD, all-time earnings
- Monthly trend chart + earnings by product type
- Recent payouts (with transfer IDs)
- Client management: add/view clients, notes
- Stripe Connect setup
- Settings: email, domain, branding

### 9.4 Partner Client Management
- **POST `/api/partner/clients`:** Invite/create client (name, email) → creates auth + profile + client linked to partner
- **PUT `/api/partner/clients`:** Add note to client
- **POST `/api/partner/vault-client-checkout`:** Send white-label vault signup link

### 9.5 Partner Revenue Endpoints
- **GET `/api/partner/revenue`:** Summary of earnings + payouts
- **POST `/api/partner/stripe-connect`:** Create/connect Stripe Express account
- **GET `/api/partner/stripe-connect`:** Check connection status

---

## 10. Affiliate Flows

### 10.1 Affiliate Signup
**Entry:** `/affiliate-signup`

```
Step 1: Create Account
  - Name, email, password, accept agreement
  - POST /api/affiliate/signup
    → Creates auth user (user_type: "affiliate")
    → Generates unique 8-char code
    → Creates Stripe Connect Express account
    → Returns onboardingUrl + code

Step 2: Stripe Connect OAuth
  - Bank info, tax details
  - Returns to /affiliate-signup?step=stripe&code={code}

Step 3: Success
  - Shows permanent referral link: /a/{affiliate_code}
  - Earnings: $100/Will, $200/Trust
```

### 10.2 Affiliate Referral Attribution
```
/a/{code} → tracked click → cookie set (90-day window)
On purchase: check cookie → record affiliate_id on order → calculate affiliate_cut
```

### 10.3 Affiliate Dashboard
**Entry:** `/affiliate`

Tabs: Overview, Performance, Payouts. Shows clicks, conversions, earnings, pending balance, payout history.

---

## 11. Admin / Sales Flows

### 11.1 Admin Capabilities
| Feature | Endpoint |
|---------|----------|
| Toggle TEST promo | GET/POST `/api/admin/test-promo` |
| Orders missing docs | `/api/admin/orders-missing-docs` |
| Farewell verification | `/api/admin/farewell-verification` |
| Marketing materials | `/api/admin/marketing/materials` |

### 11.2 Sales Partner Management
- **POST `/api/sales/create-partner`:** Create partner (email, URL, tier, source)
- **POST `/api/sales/create-rep`:** Create sales rep (admin only)
- **Partner notes:** Add/view notes
- **Last login tracking**

---

## 12. Cron Jobs & Automated Emails

### 12.1 Cron Jobs (Vercel cron, auth via `CRON_SECRET`)

| Job | Frequency | Purpose | Cooldown |
|-----|-----------|---------|----------|
| Annual Review Reminder | Daily | Email clients 1yr after delivery, yearly | 360 days |
| Life Event Check-In | Daily | Email clients 6mo after delivery, every 6mo | 175 days |
| Farewell Window Expired | Every 15 min* | Process expired veto windows | — |
| Farewell Veto Reminder | Daily | Remind about pending veto windows | — |

*Note: 15-min frequency on farewell-window-expired causes DB thrashing (known issue).

### 12.2 Email Triggers

| Event | Recipient | Template |
|-------|-----------|----------|
| Signup | Client | Welcome email |
| Documents delivered | Client | Document delivery + asset checklist |
| Attorney review pending | Client | "Awaiting attorney review" |
| Attorney review complete | Client | Reviewed documents ready |
| Payment failed (subscription) | Client | Dunning: update payment method |
| Annual review reminder | Client | "Time to review your estate plan" |
| Life event check-in | Client | "Has anything changed?" |
| Attorney partner signup (TPFP) | Sales team | New attorney notification |
| Trustee death cert submitted | Admin | Review request |
| Trustee access approved | Trustee | 7-day sign-in link |

**Email provider:** Resend. Partner white-label support (custom from email, company name, logo).

---

## 13. Pricing & Revenue Splits

### 13.1 Product Prices (source of truth: `/lib/orders/pricing.ts`)

| Product | Price |
|---------|-------|
| Will Package | $400 |
| Trust Package | $600 |
| Attorney Review Add-On | +$300 |
| Amendment | $50 (free for vault subscribers) |
| Vault Subscription | $99/year |
| Partner Platform: Basic | $500 one-time |
| Partner Platform: Standard | $1,200 one-time |
| Partner Platform: Enterprise | $6,000 one-time |

### 13.2 Revenue Splits (`/lib/stripe-payouts.ts::calculateSplit`)

| Product | Tier | EV Cut | Partner Cut |
|---------|------|--------|-------------|
| Will | Direct (no partner) | $100 | — |
| Will | Standard | $100 | $300 |
| Will | Enterprise | $50 | $350 |
| Trust | Direct | $200 | — |
| Trust | Standard | $200 | $400 |
| Trust | Enterprise | $150 | $450 |
| Amendment | Standard | $15 | $35 |
| Amendment | Enterprise | $10 | $40 |

**Affiliate splits (no partner):** Will: EV $300 / Affiliate $100. Trust: EV $400 / Affiliate $200.

**Rule:** Partner XOR Affiliate — never both on same order.

### 13.3 Promo Codes

| Code | Behavior | Scope |
|------|----------|-------|
| FREE134 | Free will/trust | Will, Trust checkout |
| TEST | $0 test order (24h expiry, demo, max 50/hr) | Will, Trust (estatevault.us only) |
| TPFP | Free attorney partner signup | Attorney signup |
| FREE676 | Free partner creation | Admin-created partners |

---

## 14. API Endpoint Catalog

### Auth
| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/auth/signup` | POST | No | Create account |
| `/api/auth/send-verify-code` | POST | No | Send 6-digit code |
| `/api/auth/verify-code` | POST | No | Verify code → token |
| `/api/auth/check-email` | POST | No | Check if email exists |
| `/api/auth/recovery` | POST | No | Send password reset |
| `/api/auth/set-password` | POST | No | Create password (webhook) |
| `/api/auth/welcome` | POST | Yes | Send welcome email |
| `/api/auth/handoff` | POST | Yes | Create handoff token |
| `/api/auth/handoff/consume` | POST | No | Consume handoff token |
| `/api/auth/verify-link` | GET/POST | No | Email verification link |
| `/api/auth/resend-verification` | POST | No | Resend verification |
| `/api/auth/check-verification` | POST | No | Check email confirmed |

### Checkout
| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/checkout/will` | POST | No | Will order → Stripe |
| `/api/checkout/trust` | POST | No | Trust order → Stripe |
| `/api/checkout/amendment` | POST | Yes | Amendment order |
| `/api/checkout/vault-subscription` | POST | No/Yes | Vault subscription → Stripe |
| `/api/checkout/attorney` | POST | No | Attorney signup → Stripe |
| `/api/checkout/partner` | POST | Yes | Partner platform fee → Stripe |
| `/api/checkout/verify` | GET | No | Verify Stripe session |

### Documents
| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/documents/generate` | POST | Yes | Queue generation job |
| `/api/documents/process` | GET | Cron | Worker processes queue |
| `/api/documents/check-status` | GET | Yes | Poll document readiness |
| `/api/documents/status` | GET | Yes | Fetch order status |
| `/api/documents/download` | GET | Yes | Download single document |
| `/api/documents/download-zip` | GET | Yes | Download all as ZIP |
| `/api/documents/download-by-session` | GET | Yes | Download by quiz session |

### Vault
| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/vault/items` | GET/POST/PATCH | Yes | CRUD vault items |
| `/api/vault/items/search` | GET | Yes | Search items |
| `/api/vault/pin` | POST/GET | Yes | PIN create/check/change |
| `/api/vault/download-url` | GET | Yes | Signed URL for vault file |

### Share
| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/share` | GET/POST/DELETE | Yes | Share/list/revoke item shares |

### Subscription
| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/subscription/status` | GET | Yes | Subscription status + permissions |
| `/api/subscription/sync` | POST | Yes | Reconcile with Stripe |
| `/api/subscription/cancel` | POST | Yes | Cancel at period end |

### Attorney
| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/attorney/review` | GET | Yes | Fetch review details |
| `/api/attorney/approve` | POST | Yes | Submit review decision |
| `/api/attorney/upload-reviewed` | POST | Yes | Upload corrected DOCX |
| `/api/attorney/review-docx` | GET | Yes | Get editable DOCX |
| `/api/attorney/check-sla` | POST | Yes | Check SLA deadline |
| `/api/attorney/notify-client` | POST | Yes | Message client |

### Partner
| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/partner/revenue` | GET | Yes | Revenue summary |
| `/api/partner/clients` | POST/PUT | Yes | Create/update client |
| `/api/partner/stripe-connect` | GET/POST | Yes | Stripe Connect setup |
| `/api/partner/vault-client-checkout` | POST | Yes | White-label vault link |
| `/api/partner/email/*` | Various | Yes | Email branding setup |

### Farewell
| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/farewell/verify` | POST | No | Submit death certificate |
| `/api/farewell/access` | POST | No | Check/request trustee access |

### Crypto (E2EE)
| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/crypto/bootstrap` | POST | Yes | Generate DEK |
| `/api/crypto/bundle` | POST | Yes | Wrap DEK |

### Webhooks
| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/webhooks/stripe` | POST | Stripe sig | Process Stripe events |

### Admin / Sales
| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/admin/test-promo` | GET/POST | Admin | Toggle TEST promo |
| `/api/admin/orders-missing-docs` | GET | Admin | Find orphan orders |
| `/api/admin/farewell-verification` | POST | Admin | Approve/reject death cert |
| `/api/sales/create-partner` | POST | Sales/Admin | Create partner |
| `/api/sales/create-rep` | POST | Admin | Create sales rep |
| `/api/sales/partner-notes` | GET/POST | Sales | Partner notes |

### Cron
| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/cron/annual-review-reminder` | GET | CRON_SECRET | Annual review emails |
| `/api/cron/life-event-checkin` | GET | CRON_SECRET | Life event emails |
| `/api/cron/farewell-window-expired` | GET | CRON_SECRET | Process expired veto windows |
| `/api/cron/farewell-veto-reminder` | GET | CRON_SECRET | Veto window reminders |

### Other
| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/contact` | POST | No | Contact form submission |
| `/api/affiliate/signup` | POST | No | Affiliate account creation |
| `/api/affiliate/onboarding/callback` | GET | No | Stripe Connect return |
| `/api/client/mark-executed` | POST | Yes | Mark docs as signed |

---

## Key Database Tables

| Table | Purpose |
|-------|---------|
| `auth.users` | Supabase auth (id, email, password, user_metadata) |
| `profiles` | User identity (user_type, full_name, email) |
| `clients` | Client entity (partner_id, vault_subscription_status, source) |
| `partners` | Partner config (tier, branding, domain, Stripe, onboarding) |
| `affiliates` | Affiliate program (code, Stripe account, earnings) |
| `orders` | Purchases (product_type, status, splits, intake_data) |
| `documents` | Generated docs (type, status, storage path, reviewed_path) |
| `attorney_reviews` | Review records (status, SLA, fee routing) |
| `quiz_sessions` | Quiz answers (JSONB, purged after generation) |
| `vault_items` | Encrypted vault data (ciphertext, nonce, category) |
| `item_shares` | Shared vault items (wrapped DEK, recipient) |
| `vault_pin` | Encrypted PIN storage |
| `audit_log` | All actions (actor, action, resource, metadata) |
