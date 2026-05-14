# EstateVault — Tester Guide

A complete, plain-English walkthrough of every feature on the EstateVault platform and how to test it. No technical background needed.

**Last updated:** 2026-05-13
**Platform:** estatevault.us (and partner subdomains like `khanlawgroup.estatevault.us`)

---

## 1. How to Use This Guide

EstateVault has **five types of users**. Each sees a different version of the site.

| User Type | Who They Are | Where They Log In |
|-----------|--------------|-------------------|
| **Client** | Regular person creating a will/trust | `estatevault.us` or partner site |
| **Partner** | Law firm, advisor, CPA reselling the platform | `pro.estatevault.us` |
| **Sales Rep** | EstateVault salesperson | `sales.estatevault.us` |
| **Review Attorney** | Attorney reviewing client documents | `admin.estatevault.us` |
| **Admin** | EstateVault staff | `admin.estatevault.us` |
| **Affiliate** | Referral partner earning commissions | `estatevault.us/affiliate` |

### Test Accounts You'll Need
Ask the dev team for credentials to:
- 1 fresh client (no purchases)
- 1 client with will purchased
- 1 client with trust + vault subscription
- 1 partner (fully onboarded)
- 1 sales rep, 1 admin, 1 review attorney, 1 affiliate

### Stripe Test Cards (Never use real cards)
- **Success:** `4242 4242 4242 4242`
- **Needs verification:** `4000 0025 0000 3155`
- **Declined:** `4000 0000 0000 0002`
- Any future expiry · Any 3-digit CVC · Any ZIP

---

## 2. Public Pages (No Login Needed)

### 2.1 Homepage — `/`
Welcomes visitors, explains service, links to quiz.

**Test:** Open `estatevault.us`. Scroll full page. Click every CTA. Resize browser to phone width.
**✅ Working:** All sections load, no broken images, buttons route correctly.
**❌ Bug:** Blank sections, broken images, dead buttons.

### 2.2 Professionals Page — `/professionals`
Recruits partners (advisors, CPAs, agents, attorneys).

**Test:**
1. Move earnings calculator slider — numbers update live.
2. Compare Standard ($1,200) vs Enterprise ($6,000).
3. Submit Request Access form (name, email, phone, company, type, client count, source).
4. Confirm: "We've received your request."

### 2.3 Perspectives — `/perspectives`
Blog/education. Verify content loads.

### 2.4 Contact — `/contact`
Fill name/email/message → submit → "Your message has been sent." Try blank → validation error.

### 2.5 Privacy `/privacy`, Terms `/terms`
Static pages. Verify they load.

### 2.6 Partner Landing — `/[partner-slug]` (e.g. `/khan-lawgroup`)
Whitelabel landing for specific firm.

**Test:** Visit `khanlawgroup.estatevault.us`. Verify partner logo, colors, firm name appear instead of EstateVault branding. Click Start → goes to quiz, still partner-branded.

---

## 3. Sign Up & Login

### 3.1 Sign Up — `/auth/signup`
**Test:**
1. Fill full name, email, password, confirm.
2. Mismatch test → "Passwords do not match."
3. Short password (<8 chars) → validation error.
4. Valid form → auto-logged in → land on `/dashboard`.

### 3.2 Login — `/auth/login`
**Test each user type** on the correct subdomain. Confirm correct redirect:
- Client → `/dashboard`
- Partner → `/pro/dashboard`
- Sales / Admin → `/sales/dashboard`
- Attorney → `/attorney`
- Affiliate → `/affiliate`

**Wrong-host tests (important):**
- Partner login on `estatevault.us` → blocked.
- Client login on `sales.estatevault.us` → blocked.
- Partner-locked client on generic site → blocked, told to use partner site.

### 3.3 Forgot Password — `/auth/forgot-password`
Enter email → submit → "Check your email." Click reset link → set new password → log in with it.

### 3.4 Vault PIN — `/auth/vault-pin`
4-digit PIN for vault access (separate from password). See Section 6.

---

## 4. Client Side (Quiz + Documents)

### 4.1 Quiz — `/quiz`
10-card wizard recommending Will or Trust.

**Test full flow:**
1. State + marital status → children Y/N → if Y, count + special needs?
2. Real estate? → multi-state? Business? Net worth?
3. Privacy / charity preferences
4. Existing plan? → replace or new
5. Names: finance manager, medical decision maker, child guardian
6. Final situation card
7. Back button preserves answers.
8. Continue blocked if required fields empty.
9. Result screen → recommendation + buttons.

**Hard-stop test:** Mark child with special needs → app stops, recommends attorney. No document generation.

**Beneficiary name test:** Enter first name only ("John") → warns name looks incomplete.

### 4.2 Will Intake — `/will`
**Test:**
1. Acknowledgment card → Continue.
2. **About:** name, DOB, city, minor children.
3. **Executor:** name, relationship, backup.
4. **Beneficiaries:** add 2 with 60/40 split. Try total ≠ 100% → blocked.
5. **Guardian** (only if minor children): primary + backup.
6. **Gifts:** organ donation, specific gifts.
7. **Review** → "Edit Answers" returns to start; "Looks Good" → checkout.
8. Quiz data pre-fills where applicable.

### 4.3 Will Checkout — `/will/checkout`
**Test:**
1. Price = **$400**.
2. Plan-conflict check: if account already has trust → conflict warning shown.
3. Test card `4242 4242 4242 4242` → success → `/will/success`.
4. Declined card `4000 0000 0000 0002` → error, no order.

### 4.4 Trust Intake — `/trust`
Same pattern as Will but 10 cards. Price = **$600**.

**Specific tests:**
- **Trustee:** "Myself" auto-fills name; "Someone else" prompts for name.
- **Distribution age:** 18/21/25/30/Custom for minors.
- **POA:** Banking required; "All of the above" toggles every power.
- **Multi-state real estate:** warning about state-specific deeds.
- **Healthcare wishes = Yes:** text area appears.

### 4.5 Trust Checkout — `/trust/checkout`
Price = **$600**. Plan-conflict check: if account already has will → conflict warning. Same test cards.

### 4.6 Attorney Review Add-On
During checkout, "Attorney Review (+$300)" option. Adding it sends order to attorney queue (Section 9).

### 4.7 Will Success — `/will/success`
**Test:**
1. After purchase, see stepped progress: payment → document generation → ready.
2. Page polls every 5 sec until 3 documents ready (Will, POA, Healthcare Directive).
3. **Sealed PDFs:** require vault passphrase to download. Unsealed: download directly.
4. Attorney review orders: 48h review timeline shown.
5. New accounts: "Set password" prompt appears.

### 4.8 Trust Success — `/trust/success`
Same as Will Success but 4 documents (Trust, Pour-Over Will, POA, Healthcare Directive). Complex estates flagged for attorney review show "Under review" badge. Asset funding checklist reference shown.

---

## 5. Client Dashboard

### 5.1 Dashboard Home — `/dashboard`
**Verify:**
- "Welcome back, [Name]"
- Progress ring 0–100%
- Next-action card (context-aware)
- Package status card
- Document download/email buttons after purchase

**Progress-state tests:**
| State | Expected Next Action |
|-------|---------------------|
| No purchase | "Take the quiz" |
| Just purchased | "Sign your documents" |
| Documents signed | "Set up your vault" |
| Trust + signed | "Fund your trust" |
| Account >12 months | Annual review banner |

### 5.2 Documents — `/dashboard/documents`
**Test:** Download PDF → opens in new tab. Email Documents → confirms send. Execution Guide → witness/notary steps. Check "Documents executed" → progress ring updates.

### 5.3 Funding Checklist — `/dashboard/funding-checklist` (Trust clients)
Tick asset transfer items → progress updates.

### 5.4 Amendment Request — `/dashboard/amendment`
Describe change ("Update executor name") → submit → receipt confirmation.

### 5.5 Life Events — `/dashboard/life-events`
Tick event (marriage, child) → app suggests amendment.

### 5.6 Settings — `/dashboard/settings`
Change name → save → reload to confirm. Change password → log out → log in with new. Manage vault PIN. Delete account (use throwaway only).

---

## 6. Vault — End-to-End Encrypted (E2EE)

### 6.1 Vault Setup (First-Time E2EE Setup) — `/onboarding/vault-setup`
Required before vault can be used. 4-step flow.

**Test:**
1. Create 4-digit PIN.
2. Create secure passphrase (strong, memorable).
3. System shows **24-word recovery mnemonic** — write it down.
4. Confirm mnemonic by re-entering selected words.
5. Redirect to dashboard. Vault now ready.

**Critical:** Recovery mnemonic shown only once. Save it. If lost AND passphrase lost → vault data gone forever.

### 6.2 Recover Passphrase — `/recover`
For owners who forgot passphrase.

**Test:**
1. Enter 24-word recovery mnemonic.
2. Set new passphrase.
3. Old passphrase no longer works.
4. Vault items still accessible with new passphrase.
5. Wrong mnemonic → "Recovery failed" error.

### 6.3 Subscription Gate
Non-subscribers see Upgrade modal ($99/year). Upgrade → Stripe checkout.

### 6.4 PIN Setup & Unlock
**First time:** Enter 4-digit PIN twice → saved.
**Returning:** Enter PIN to unlock.
- Wrong PIN → "Incorrect PIN."
- Correct PIN → vault opens.
- Idle 10 min → auto-locks, PIN required again.

### 6.5 Categories (8 total) — `/dashboard/vault`
Estate Documents · Financial Accounts · Insurance · Digital Accounts · Physical Locations · Contacts · Business · Final Wishes.

**For each:**
1. Click card → see encrypted item list.
2. Add Item → form per category (e.g. Financial = institution, type, last 4, notes).
3. Save → item appears.
4. View → modal shows details.
5. Show/Hide toggle on passwords/codes.
6. Delete → item gone.

### 6.6 Vault Search
**Test:** Add item → search by label → encrypted result decrypts and shows. Server only sees hashed label, never plaintext.

### 6.7 Document Upload (Estate Documents only)
1. Drag PDF onto drop zone.
2. Add label + document type.
3. Upload (max 20MB). File encrypted before storage.
4. Click Download → decrypts → PDF opens.
5. File >20MB → blocked.
6. Non-PDF → blocked.

### 6.8 Trustees — `/dashboard/vault/trustees`
Designate up to 2 people for emergency vault access (post-death).

**Test:**
1. Add trustee: name, email, relationship.
2. Send invite → email sent.
3. Status: Pending invitation → Awaiting 72h → Active.
4. Revoke trustee → removed.

### 6.9 Trustee Access Initialize (Shamir Setup) — `/dashboard/vault/trustees/init`
One-time crypto setup splitting master key into Shamir shares (so trustees can unlock without passphrase).

**Test:**
1. Enter 24-word recovery phrase in browser.
2. System generates shares A (owner), B (ephemeral), C (server-encrypted).
3. "Trustee access initialized" message.
4. Visit page again → "already initialized" status.

### 6.10 Farewell Messages — `/dashboard/vault/farewell`
Owner records video messages or uploads PDFs for family (released post-death).

**Test:**
1. Click Record New Message → allow webcam/mic.
2. Record 30–60 sec → add title + recipient email.
3. Save.
4. **Critical:** Save must not complete until upload finishes. If save before upload bar done → bug.
5. Message appears with "locked" status.
6. Delete message → gone.

---

## 7. Trustee Flow (After Owner's Death)

### 7.1 Trustee Unlock — `/trustee/unlock?token=[TOKEN]`
Trustee receives email link.

**Test:**
1. Open link from email.
2. System sends 6-digit OTP to trustee email.
3. Enter OTP → correct code → redirects to `/trustee/vault`.
4. Wrong OTP → error, retry.
5. Expired token → "Token expired" message.

### 7.2 Trustee Vault Viewer — `/trustee/vault`
Read-only view of decrypted vault.

**Test:**
1. After unlock, all 8 categories appear.
2. Click category → items list.
3. Show/hide on sensitive fields.
4. Download sealed documents → PDF opens.
5. Idle 30 min → session resets, must re-unlock.

### 7.3 Trustee Farewell Access — `/farewell/[clientId]`
**Test:**
1. Trustee submits death certificate (scan/photo).
2. Admin verifies → 72h access window opens.
3. Trustee enters email → unlocked messages appear.
4. Play video → decrypts in browser, plays via HTML5 player.
5. Download PDF → decrypts, saves locally.

### 7.4 Owner Veto — `/farewell/owner-veto?token=[TOKEN]`
If owner alive when trustee requests access, owner gets email with veto link.

**Test:**
1. Trigger trustee access request.
2. Owner opens email, clicks veto link.
3. Page shows request status.
4. Click "I'm alive — Cancel Access."
5. Farewell messages revert to "locked."
6. Trustee receives rejection email.

---

## 8. Partner Portal — `pro.estatevault.us`

### 8.1 Onboarding
Fresh partner forced through steps:
1. Company info, license
2–4. Vault customization (if vault tier)
6. Training consent
7. Review & launch

Skip required field → blocked. Complete all → `/pro/dashboard`.

### 8.2 Dashboard — `/pro/dashboard`
Verify firm logo/colors/name. Stats display.

### 8.3 Clients — `/pro/clients`
**Test:** View list. Invite New Client → referral link. Open link incognito → partner-branded signup. Signup → partner sees new client. Click client → progress + orders.

### 8.4 Vault Clients — `/pro/vault-clients`
View vault subscribers. Create new vault client → Stripe checkout → client email to set up.

### 8.5 Marketing — `/pro/marketing`
Browse templates, download copy.

### 8.6 Referrals — `/pro/referrals`
Copy referral link. View stats.

### 8.7 Revenue — `/pro/revenue`
View chart. Change date range. Verify splits: Standard ($300 will, $400 trust) / Enterprise ($350 / $450). Payout history.

### 8.8 Sales Sub-Portal — `/pro/sales/*`
Pipeline (Kanban), commissions, new partners. Drag deals → persists after reload.

### 8.9 Training — `/pro/training`
Module 1 → unlocks Module 2 → all modules → exam. Pass = 80%+. Pass → training complete.

### 8.10 Settings — `/pro/settings`
Upload logo → appears client-side. Set custom colors → branding updates. Connect Stripe. Add team member email.

---

## 9. Sales / Admin Portal — `sales.estatevault.us`

### 9.1 Sales Dashboard — `/sales/dashboard`
Overview: pipeline, commissions, assigned partners.

### 9.2 Pipeline — `/sales/pipeline`
Kanban drag-drop. Stage change persists.

### 9.3 Partner Commissions — `/sales/commission`
**Test:** Commission breakdown. Default rate = **50%** for salespeople. MTD breakdown table shows Status column.

### 9.4 Partners — `/sales/partners` (Admin only)
View all partners. Filter by status. Open partner → details.

### 9.5 New Partner — `/sales/new-partner`
Fill form → partner invited.

### 9.6 Farewell Verification — `/sales/farewell-verification` (Admin only)
**Test:** View pending requests. Review death certificate. Approve / reject. Approve → trustee gets access email.

### 9.7 Sidebar Label
Admin login: sidebar says **"Admin Portal"**.
Sales rep login: sidebar says **"Sales Portal"**.

---

## 10. Attorney Portal — `admin.estatevault.us/attorney`

### 10.1 Attorney Dashboard — `/attorney`
Auto-redirects to `/attorney/dashboard`.

### 10.2 Review Queue — `/attorney/reviews`
**Test:** Queue of orders with attorney review purchased. Click order → intake + draft docs. Add comments. Approve or Needs Revision. Client emailed.

### 10.3 Attorney Pipeline (Kanban)
Compact cards, no horizontal scroll. Drag-drop persists.

### 10.4 Attorney Signup — `/partners/attorneys/signup`
Public application. Fill, submit. Status: pending_verification.

### 10.5 Welcome — `/partners/attorneys/welcome`
New attorney lands here. "Ready" → waits for admin approval.

---

## 11. Affiliate Program

### 11.1 Signup — `/affiliate-signup`
Fill form, accept terms → Stripe Connect → complete → status active.

### 11.2 Dashboard — `/affiliate`
**Test:**
1. Copy referral link (`/a/[code]`).
2. Open incognito → lands on homepage.
3. Sign up new client through link.
4. Place order with test card.
5. Affiliate dashboard: clicks +1, conversions +1, earnings updated.
6. Payout history.

### 11.3 Referral Link — `/a/[code]`
Tracks click silently, redirects to homepage.

---

## 12. Cross-Cutting Always-Test

### 12.1 Pricing — NEVER Changes
| Item | Price |
|------|-------|
| Will Package | $400 |
| Trust Package | $600 |
| Attorney Review Add-On | $300 |
| Amendment | $50 |
| Vault Subscription | $99/year |

Any different price = bug.

### 12.2 Forbidden Language
Platform must **never** say:
- "We recommend..." (must say "Based on your answers...")
- The word "death" in client-facing copy
- Anything sounding like legal advice

### 12.3 Hard Stops
- Special needs dependent → stop, refer to attorney.
- Irrevocable trust requested → stop, refer to attorney.

### 12.4 Plan Conflict
- Account has will → trust checkout shows conflict warning.
- Account has trust → will checkout shows conflict warning.

### 12.5 Emails to Verify
- Signup confirmation
- Password reset
- Order confirmation
- Document ready
- Trustee invitation
- Trustee OTP (unlock)
- Farewell release notification
- Owner veto email
- Affiliate payout
- Contact form submission
- Partner request access confirmation

### 12.6 Mobile / Tablet
Re-test on phone: Homepage, Quiz, Will/Trust intake, Dashboard, Vault. Tappable buttons, readable text, no horizontal scroll.

---

## 13. How to Report a Bug

Log every bug in the shared bug-tracking sheet with these columns:

1. **Priority**
2. **Bug ID**
3. **Title**
4. **Description**
5. **Expected**
6. **Page/Panel**

**Bug tracker:** [Open Bug Tracking Sheet](https://excel.cloud.microsoft/open/onedrive/?docId=1299A47546CADAAF%21s21edd17b410f4cc293efe01f933114f3&driveId=1299A47546CADAAF)

---

## 14. Quick-Reference Test Matrix

| Area | Critical Tests |
|------|---------------|
| Auth | Login per role on correct host; wrong host blocks |
| Quiz | All 10 cards; hard stop on special needs |
| Will | Beneficiary shares = 100%; review summary correct |
| Trust | Trustee picker; POA "all of the above"; distribution age |
| Checkout | $400 will, $600 trust; plan conflict warning; declined card error |
| Success Pages | Documents poll and become downloadable; sealed PDFs need passphrase |
| Vault Setup | PIN → passphrase → 24-word mnemonic → confirm → redirect |
| Recovery | Mnemonic + new passphrase replaces old |
| Vault | PIN unlock, 10-min auto-lock, drag-drop PDF, encrypted search |
| Trustees Init | Recovery phrase → Shamir shares stored → "Initialized" |
| Trustees | Invite → 72h timer → active |
| Trustee Unlock | Email link → OTP → vault viewer |
| Trustee Vault | All 8 categories decrypt; 30-min idle reset |
| Farewell Owner | Video doesn't save before upload completes |
| Farewell Trustee | Cert verified → 72h access → videos play, PDFs decrypt |
| Owner Veto | Veto link → cancel → trustee notified, messages re-lock |
| Partner | Onboarding 7 steps; branding applied; client list updates |
| Sales | Pipeline drag-drop persists; 50% default rate |
| Attorney | Review queue; approve/revise notifies client |
| Affiliate | `/a/[code]` tracks click → signup → order = commission |

---

**End of Guide.** Work through it section by section. Don't skip wrong-host auth tests and E2EE recovery/trustee flows — those catch the biggest issues.
