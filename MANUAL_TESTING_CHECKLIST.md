# EstateVault — Manual Testing Checklist

Run through each section in order. Mark [x] when passing, [ ] when failing.
Add notes for any bugs found.

**Setup before testing:**
1. `npm run dev` — app on localhost:3000
2. Open browser with DevTools Network tab visible
3. Stripe CLI running: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
4. Use fresh/incognito window for each user type test

---

## PHASE 1: Landing → Quiz → Purchase (the real user flow)

### 1.1 Landing Page
- [x] Go to `/` — page loads, hero section visible
- [x] "Create a Will" CTA → goes to `/will`
- [x] "Create a Trust" CTA → goes to `/trust`
- [x] "Take a free quiz" CTA → goes to `/quiz`
- [x] Mobile responsive — no broken layout on small viewport

### 1.2 Quiz Flow
- [x] Go to `/quiz` → first question card loads
- [x] Answer questions → progress bar advances
- [x] Navigate back → previous answers preserved
- [x] Complete quiz → processing animation → results screen
- [x] Results say "Based on your answers..." (NEVER "We recommend...")
- [x] Low net worth + no real estate + no business → recommends Will ($400)
- [x] Higher net worth or real estate or business → recommends Trust ($600)
- [x] CTA button links to `/will` or `/trust` based on recommendation

### 1.3 Acknowledgment & Intake (Will — `/will`)
- [x] `/will` loads → acknowledgment screen first
- [x] Must sign acknowledgment before proceeding (document preparation disclaimer)
- [x] After acknowledgment → intake form loads
- [x] Fill in all intake cards (personal info, executor, beneficiaries, etc.)
- [x] Back/Continue navigation works, preserves data
- [x] City autocomplete works
- [x] DOB picker works
- [x] Review card → "Looks Good, Continue" → redirects to `/will/checkout`

### 1.4 Acknowledgment & Intake (Trust — `/trust`)
- [x] Same flow as will at `/trust`
- [x] Trust-specific fields appear (trustee selection, asset types)
- [x] Review → redirects to `/trust/checkout`

### 1.5 Hard Stops (CRITICAL — must never bypass)
- [ ] During intake: indicate special needs dependent → generation HALTS
- [ ] Shows attorney referral message (not just an error)
- [ ] No way to proceed past hard stop (refresh, back, URL hack)
- [ ] During intake: indicate irrevocable trust → generation HALTS
- [ ] Shows attorney referral message
- [ ] No payment taken, no document generated

### 1.6 Checkout — Will ($400)
- [ ] `/will/checkout` loads → shows order summary
- [ ] Email verification gate: enter email → verify via code
- [ ] Code email arrives → enter code → verified
- [ ] Attorney Review add-on option visible ($300 extra)
- [ ] "Proceed to Payment" → redirects to Stripe Checkout
- [ ] Stripe shows correct price ($400, or $700 with attorney review)
- [ ] Use test card `4242 4242 4242 4242` → payment succeeds
- [ ] Redirected to `/will/success`
- [ ] Account created automatically (can now login with email)

### 1.7 Checkout — Trust ($600)
- [ ] Same flow at `/trust/checkout` but price = $600
- [ ] With attorney review = $900
- [ ] Redirected to `/trust/success`

### 1.8 Payment Edge Cases
- [ ] Declined card `4000 0000 0000 0002` → shows error on Stripe page
- [ ] After successful payment → webhook fires → order created in DB
- [ ] Revenue split correct (check DB: platform keeps $100/will, $200/trust)

---

## PHASE 2: Login & Access Control

### 2.1 Login Flow
- [ ] Go to `/auth/login` — page loads
- [ ] Login with client credentials (created during checkout) → lands on `/dashboard`
- [ ] Login with partner credentials → lands on `/pro/dashboard`
- [ ] Login with sales rep credentials → lands on `/sales/dashboard`
- [ ] Login with attorney credentials → lands on `/attorney`
- [ ] Wrong password → shows error (no info leak about email existence)
- [ ] Non-existent email → same generic error

### 2.2 Password Reset
- [ ] Go to `/auth/forgot-password`
- [ ] Enter valid email → shows "check your email"
- [ ] Click reset link in email → lands on reset password page
- [ ] Enter new password → success → can login with new password
- [ ] Try expired/reused reset link → shows error

### 2.3 Cross-Portal Guards
- [ ] Logged in as client → try visiting `/pro/dashboard` → redirected away
- [ ] Logged in as partner → try visiting `/sales/dashboard` → redirected away
- [ ] Logged in as sales rep → try visiting `/dashboard` → redirected away
- [ ] Not logged in → try visiting `/dashboard` → redirected to `/auth/login`
- [ ] Not logged in → try visiting `/pro/dashboard` → redirected to login

### 2.4 Standalone Signup (vault-only / partner-referred)
- [ ] `/auth/signup` — page loads
- [ ] Enter email → "Verify Email" → code input appears
- [ ] Enter code → email verified → fill password → create account
- [ ] With `?partner=slug` param → vault flow checkout redirect works
- [ ] Existing email → shows "account already exists" warning

---

## PHASE 3: Client Dashboard (post-purchase)

### 3.1 Dashboard Home
- [ ] `/dashboard` loads → shows overview (documents, vault status)
- [ ] Vault-only client → redirected to `/dashboard/vault`

### 3.2 Documents
- [ ] `/dashboard/documents` → lists generated documents
- [ ] Can download each document (PDF)
- [ ] Documents marked with correct status (generated, under review, approved)

### 3.3 Settings
- [ ] `/dashboard/settings` → page loads
- [ ] Can update profile info
- [ ] Can change password

### 3.4 Life Events
- [ ] `/dashboard/life-events` → page loads
- [ ] Can record a life event (marriage, birth, etc.)
- [ ] Shows recommendation to review documents

### 3.5 Funding Checklist (Trust clients only)
- [ ] `/dashboard/funding-checklist` → shows trust funding steps
- [ ] Can mark steps as complete

### 3.6 Amendment ($50)
- [ ] From `/dashboard/amendment` → can request document amendment
- [ ] Price = $50
- [ ] Payment → amendment processed

---

## PHASE 4: Vault (E2EE — highest security risk)

### 4.1 Vault Setup
- [ ] First-time vault user → prompted to create PIN/passphrase
- [ ] PIN created → vault unlocks
- [ ] Vault dashboard shows empty state

### 4.2 Vault Items CRUD
- [ ] Add vault item (insurance policy, bank account, etc.)
- [ ] Item appears in list after save
- [ ] Edit existing item → changes persist
- [ ] Delete item → removed from list
- [ ] Search items → filters correctly
- [ ] Categories filter works

### 4.3 Vault File Upload
- [ ] Upload a file to vault → upload completes
- [ ] Download uploaded file → content matches original
- [ ] Upload large file (~10MB) → handles gracefully
- [ ] Upload unsupported file type → shows error or accepts (check policy)

### 4.4 Vault PIN/Session
- [ ] Close browser → reopen → vault locked (must re-enter PIN)
- [ ] Wrong PIN → rejected, shows error
- [ ] 3+ wrong attempts → rate limited or locked
- [ ] Session refresh (F5) → vault stays unlocked (sessionStorage)

### 4.5 Trustees
- [ ] `/dashboard/vault/trustees` → page loads
- [ ] Add trustee (name, email, relationship) → appears in list
- [ ] Invalid email → rejected
- [ ] Empty name → rejected
- [ ] Remove trustee → removed from list

### 4.6 Farewell Messages
- [ ] `/dashboard/vault/farewell` → page loads
- [ ] Create farewell message (title, recipient email)
- [ ] Attach file to farewell (optional)
- [ ] Edit farewell → changes saved
- [ ] Delete farewell → removed

---

## PHASE 5: Trustee Unlock Flow

### 5.1 Trustee Access
- [ ] Go to `/trustee/unlock` (not logged in as vault owner)
- [ ] Enter trustee email → OTP sent
- [ ] Enter correct OTP → vault access granted
- [ ] Wrong OTP → rejected
- [ ] Can view vault owner's items (read-only)
- [ ] Cannot edit/delete owner's items
- [ ] Can download files

### 5.2 Farewell Delivery
- [ ] After verification → farewell messages delivered to recipients
- [ ] Owner veto within window → message cancelled
- [ ] Veto after window expires → rejected (too late)

---

## PHASE 6: Partner Portal (/pro/*)

### 6.1 Partner Onboarding
- [ ] `/pro/onboarding/step-1` → loads
- [ ] Complete each step (1 through 7) → progress saves between steps
- [ ] Can go back to previous steps
- [ ] Final step → partner account activated

### 6.2 Partner Dashboard
- [ ] `/pro/dashboard` → loads with stats (client count, revenue, activity)
- [ ] Recent activity list shows real data
- [ ] Stats numbers make sense (not NaN, not negative)

### 6.3 Partner Clients
- [ ] `/pro/clients` → lists partner's clients
- [ ] Can click into client detail → `/pro/clients/[id]`
- [ ] Client detail shows orders, documents, status
- [ ] CANNOT see another partner's clients (try changing ID in URL)

### 6.4 Partner Documents
- [ ] `/pro/documents` → lists documents for partner's clients
- [ ] Can filter/search

### 6.5 Partner Revenue
- [ ] `/pro/revenue` → shows earnings breakdown
- [ ] Standard partner: $300/will, $400/trust displayed
- [ ] Revenue numbers match actual orders

### 6.6 Partner Referrals
- [ ] `/pro/referrals` → page loads
- [ ] Can create/track referrals

### 6.7 Partner Settings
- [ ] `/pro/settings` → can update company info
- [ ] Custom domain setup (if applicable)
- [ ] Email configuration

### 6.8 White-Label / Branding
- [ ] Partner slug page (`/[partner-slug]`) → loads with partner branding
- [ ] Partner accent color applied
- [ ] Client purchasing through partner link → partner gets credit

---

## PHASE 7: Sales Portal (/sales/*)

### 7.1 Sales Dashboard
- [ ] `/sales/dashboard` → loads with pipeline stats
- [ ] Shows managed partners

### 7.2 Partner Management
- [ ] `/sales/partners` → lists assigned partners
- [ ] Click partner → detail page with performance
- [ ] `/sales/new-partner` → can onboard new partner
- [ ] Partner creation → partner receives welcome email

### 7.3 Pipeline
- [ ] `/sales/pipeline` → shows prospecting pipeline
- [ ] Can move prospects through stages

### 7.4 Commission
- [ ] `/sales/commission` → shows earnings
- [ ] Numbers match partner activity

### 7.5 Admin-Only Pages (logged in as admin)
- [ ] `/sales/affiliates` → affiliate management
- [ ] `/sales/marketing-materials` → asset management
- [ ] `/sales/farewell-verification` → verification queue
- [ ] Regular sales rep CANNOT access these pages

---

## PHASE 8: Attorney Portal

### 8.1 Attorney Dashboard
- [ ] `/attorney/dashboard` → loads with review queue
- [ ] Shows pending document reviews

### 8.2 Document Review
- [ ] `/attorney/reviews` → lists documents pending review
- [ ] Click review → `/attorney/review/[id]`
- [ ] Can download DOCX version of document
- [ ] Can edit and re-upload reviewed document
- [ ] Approve document → client notified
- [ ] SLA timer visible (check-sla endpoint)

### 8.3 Attorney Earnings
- [ ] `/attorney/commission` → shows $300 per review
- [ ] 100% of attorney review fee goes to attorney (platform takes $0)

---

## PHASE 9: Stripe & Payments (detailed)

### 9.1 Stripe Connect (Partners)
- [ ] Partner Stripe Connect onboarding → `/api/stripe/connect/onboard`
- [ ] After onboarding → status shows connected
- [ ] Partner payouts arriving to connected account

### 9.2 Vault Subscription
- [ ] Vault subscription checkout works
- [ ] Subscription status reflected in dashboard
- [ ] Cancel subscription → status updates

### 9.3 Webhook Verification
- [ ] Stripe CLI forwarding to `/api/webhooks/stripe`
- [ ] Complete a payment → webhook fires → order status updates
- [ ] Tampered payload → rejected (signature check)

---

## PHASE 10: Edge Cases & Security

### 10.1 URL Manipulation
- [ ] Change client ID in URL → cannot access other users' data
- [ ] Change partner ID in URL → cannot access other partners' data
- [ ] Access API routes directly without auth → 401/403
- [ ] SQL injection in search fields → no error, no data leak
- [ ] XSS in text inputs → sanitized, not rendered

### 10.2 Rate Limiting
- [ ] Rapid-fire login attempts → eventually rate limited
- [ ] Rapid-fire API calls → rate limited
- [ ] Rapid-fire OTP requests → rate limited

### 10.3 Session Handling
- [ ] Logout → all cookies cleared
- [ ] Cannot access protected pages after logout
- [ ] Session expires naturally → redirected to login
- [ ] Multiple tabs → session consistent across tabs

### 10.4 Forbidden Language Check
- [ ] Search entire UI for word "death" → should NOT appear
- [ ] Everything framed as "protection" language
- [ ] No "We recommend..." anywhere → only "Based on your answers..."

---

## Bug Log

| # | Phase | Description | Severity | Screenshot |
|---|-------|-------------|----------|------------|
| 1 | 2.4   | useEffect reset verifyStage from code_sent→idle (fixed) | High | — |
| 2 | 2.4   | authSignupSchema rejected null partnerSlug (fixed) | Medium | — |
| 3 | 2.2   | Password reset link reusable — clicking "change password" a second time still works (should expire/invalidate after first use) | High | — |
| 3 |       |             |          |            |

---

## Notes
- Test on Chrome + one other browser (Firefox/Safari)
- Test mobile viewport (responsive)
- Check console for JS errors on every page
- Check Network tab for failed API calls (red rows)
- Pricing is FIXED — partners cannot change: Will $400, Trust $600, Attorney Review $300, Amendment $50
- The real user flow is: Landing → Quiz → Intake → Checkout (account created here) → Stripe → Success
- `/auth/signup` is a secondary path for vault-only signups and partner-referred users
