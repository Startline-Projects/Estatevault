# EstateVault — Complete Tester Guide

A complete, plain-English walkthrough of every feature on the EstateVault platform and how to test it. **No technical background needed.** If this is your first time on the platform, start at Section 1 and read straight through.

**Last updated:** 2026-05-13
**Platform:** estatevault.us (and partner subdomains like `khanlawgroup.estatevault.us`)

---

## 1. What Is EstateVault?

EstateVault is an online **estate planning platform**. In plain terms, it helps ordinary people create the legal documents that say what happens to their money, property, and family if they pass away or can't make decisions for themselves.

Think of it like TurboTax, but for wills and trusts instead of taxes. The person answers simple questions, the platform builds the legal documents from those answers, and the person downloads and signs them.

### What the platform produces
- **Will** — a document saying who gets your belongings and who looks after your children.
- **Trust** — a more advanced plan that can avoid court (probate), keep things private, and control when money is given out.
- **Supporting documents** — Power of Attorney (someone to handle finances), Healthcare Directive (someone to make medical decisions), and a Pour-Over Will.
- **The Vault** — a secure, encrypted online safe where the person stores passwords, account info, insurance details, and recorded video "farewell" messages for family.

### How the business works
EstateVault is sold two ways:
1. **Direct to consumers** at `estatevault.us`.
2. **Through partners** — law firms, financial advisors, CPAs, and insurance agents who put their own logo and branding on the platform and offer it to their clients. This is called "white-label."

Because of this, the platform has **five different types of users**, and each one sees a different version of the site. Understanding who you are logged in as is the single most important thing when testing.

### Important rules the platform must always follow
These are core business rules. If you see the platform break one of these, it is a **high-priority bug**:
- The platform **never gives legal advice**. It only builds documents from the answers given.
- Quiz results must say **"Based on your answers..."** — never "We recommend..."
- The platform should **never use the word "death"** in text shown to clients. It uses gentler framing.
- Certain situations (a family member with special needs, a request for an irrevocable trust) must **stop the process** and refer the person to a real attorney. This cannot be bypassed.
- Prices are **fixed** and must never change (see Section 12.1).

---

## 2. How to Use This Guide

Every test in this guide is written in the same format so you always know what to do:

> **What you're testing:** a one-line explanation of the feature.
> **Steps:** what to click and type, in order.
> **Expected result:** exactly what should happen if the feature works.
> **❌ Bug signs:** what it looks like when something is broken.

Work through the guide **section by section**. Don't jump around — later tests sometimes need data created in earlier tests (for example, you must purchase a will before you can test the documents page).

### The five user types

| User Type | Who They Are | Where They Log In |
|-----------|--------------|-------------------|
| **Client** | A regular person creating a will/trust for themselves | `estatevault.us` or a partner site |
| **Partner** | A law firm, advisor, or CPA reselling the platform | `pro.estatevault.us` |
| **Sales Rep** | An EstateVault salesperson who signs up partners | `sales.estatevault.us` |
| **Review Attorney** | An attorney who checks client documents for quality | `admin.estatevault.us` |
| **Admin** | EstateVault internal staff | `admin.estatevault.us` |
| **Affiliate** | A referral partner who earns commission for sending traffic | `estatevault.us/affiliate` |

### Test accounts you need before starting
Ask the development team for login details for each of these. You cannot test most of the platform without them:
- 1 fresh client account (brand new, no purchases)
- 1 client who already purchased a **will**
- 1 client who already purchased a **trust** and has a **vault subscription**
- 1 partner account (fully onboarded and live)
- 1 sales rep account
- 1 admin account
- 1 review attorney account
- 1 affiliate account

### Stripe test cards — NEVER use a real card
Payments run through Stripe in test mode. Use only these card numbers:
- **Successful payment:** `4242 4242 4242 4242`
- **Card needs extra verification:** `4000 0025 0000 3155`
- **Card declined:** `4000 0000 0000 0002`
- For all of them: any future expiry date, any 3-digit security code, any ZIP code.

### General things to check on every single page
- Page loads fully with no blank or broken sections.
- No images are broken (missing image icon).
- No raw error text or code is visible on screen.
- Every button and link does something.
- The page looks correct on a phone-sized screen too (resize your browser narrow).

---

## 3. Public Pages (No Login Needed)

These pages anyone can see without an account.

### 3.1 Homepage — `/`
**What you're testing:** The main marketing page that introduces the service to first-time visitors and pushes them toward the quiz.
**Steps:**
1. Open `estatevault.us`.
2. Scroll slowly from the top of the page to the bottom.
3. Click every button you see (Get Started, Take the Quiz, Learn More, etc.).
4. Make your browser window narrow (phone width) and scroll again.
**Expected result:** Every section loads with text and images. Buttons take you to the quiz or the signup page. The layout still looks neat on a narrow screen.
**❌ Bug signs:** Blank gaps, broken images, buttons that do nothing, text overlapping or running off the screen on mobile.

### 3.2 Professionals Page — `/professionals`
**What you're testing:** The recruitment page that convinces financial advisors, CPAs, and attorneys to become paying partners.
**Steps:**
1. Visit `/professionals`.
2. Find the **earnings calculator** and drag its slider left and right.
3. Compare the **Standard ($1,200)** and **Enterprise ($6,000)** pricing tiers.
4. Scroll to the **Request Access** form. Fill in name, email, phone, company, professional type, client count, and how they heard about it.
5. Submit the form.
**Expected result:** The calculator numbers update instantly as you drag. The two pricing tiers show clear feature lists. After submitting, you see a confirmation message: "We've received your request."
**❌ Bug signs:** Calculator frozen or showing wrong math, form submits with no confirmation, form throws an error with no explanation.

### 3.3 Perspectives — `/perspectives`
**What you're testing:** The blog / education page.
**Steps:** Open `/perspectives` and scroll through.
**Expected result:** Articles and educational content display properly.
**❌ Bug signs:** Empty page, broken article links.

### 3.4 Contact — `/contact`
**What you're testing:** The general contact form for questions from the public.
**Steps:**
1. Fill in name, email, and message. Submit.
2. Try submitting again with all fields blank.
**Expected result:** A valid submission shows "Your message has been sent." A blank submission shows a clear validation error telling you what's missing.
**❌ Bug signs:** Form submits empty, no confirmation message appears, error text is technical or confusing.

### 3.5 Privacy `/privacy` and Terms `/terms`
**What you're testing:** The legal policy pages.
**Steps:** Open each page.
**Expected result:** Full legal text displays, properly formatted.
**❌ Bug signs:** Empty page, cut-off text.

### 3.6 Partner Landing Page — `/[partner-slug]` (e.g. `/khan-lawgroup`)
**What you're testing:** The white-label landing page — the version of the site a partner firm shows to *their* clients, with the firm's own branding instead of EstateVault's.
**Steps:**
1. Visit a partner address such as `khanlawgroup.estatevault.us`.
2. Look at the logo, colors, and company name.
3. Click the Start / Get Started button.
**Expected result:** You see the *partner firm's* logo, colors, and name — not EstateVault's. Clicking Start takes you into the quiz, and the partner branding stays on.
**❌ Bug signs:** EstateVault branding shows instead of the partner's, branding disappears once you start the quiz, wrong firm's logo appears.

---

## 4. Sign Up & Login

### 4.1 Sign Up — `/auth/signup`
**What you're testing:** Creating a brand-new client account.
**Steps:**
1. Go to `/auth/signup`.
2. Fill in full name, email, password, and confirm password.
3. **Mismatch test:** put a different value in "confirm password" and submit.
4. **Short password test:** use a password under 8 characters and submit.
5. **Success test:** fill everything in correctly and submit.
**Expected result:** The mismatch shows "Passwords do not match." The short password shows a length error. A valid form creates the account, logs you in automatically, and lands you on `/dashboard`.
**❌ Bug signs:** Account created despite mismatched passwords, no error messages, stuck on a loading spinner.

### 4.2 Login — `/auth/login`
**What you're testing:** Logging in, and the security rule that each user type can only log in from the correct web address.
**Steps (do this for each user type):**
1. Go to the correct subdomain for that user type (see the table in Section 2).
2. Enter their email and password.
3. Note where you land.
**Expected result — correct landing pages:**
- Client → `/dashboard`
- Partner → `/pro/dashboard`
- Sales Rep and Admin → `/sales/dashboard`
- Review Attorney → `/attorney`
- Affiliate → `/affiliate`

**Wrong-host security tests (very important — these catch serious bugs):**
1. Try logging in as a **partner** on `estatevault.us` (the client site).
2. Try logging in as a **client** on `sales.estatevault.us`.
3. Try logging in as a client who belongs to a partner firm, but on the generic `estatevault.us` site.
**Expected result:** All three are **blocked**. The user is told to use the correct portal. The partner-locked client is told to log in through their partner's site.
**❌ Bug signs:** Any user logs in successfully on the wrong site. This is a high-priority security bug.

### 4.3 Forgot Password — `/auth/forgot-password`
**What you're testing:** The password reset flow.
**Steps:**
1. Enter your email and submit.
2. Open the reset email and click the link.
3. Set a new password.
4. Log in with the new password.
**Expected result:** You see "Check your email." The email arrives with a working link. The new password lets you log in; the old one does not.
**❌ Bug signs:** No email arrives, reset link is broken or expired immediately, old password still works after reset.

### 4.4 Vault PIN — `/auth/vault-pin`
**What you're testing:** The separate 4-digit PIN that protects the Vault (this is *not* the account password). Full vault testing is in Section 6.

---

## 5. Client Side — The Quiz and Document Creation

### 5.1 The Quiz — `/quiz`
**What you're testing:** The 10-card questionnaire that figures out whether the person needs a Will or a Trust.
**Steps:**
1. Start at `/quiz`.
2. Answer each card in order: state and marital status; children (and if yes, how many and any with special needs); real estate (and if yes, multiple states, a business, net worth); privacy and charity preferences; existing plan (replace or start new); names for finance manager, medical decision maker, and child guardian; a final situation card.
3. Use the **Back** button between cards.
4. On a card with required fields, leave one blank and try to click **Continue**.
5. Finish the quiz and reach the result screen.
**Expected result:** Each card accepts your answers. The Back button returns you to the previous card with your answers still filled in. Continue is **blocked** until required fields are filled. The final result screen shows a personalized recommendation phrased as **"Based on your answers..."** with buttons to start a Will or Trust.
**❌ Bug signs:** Answers lost when going back, Continue works with empty required fields, result says "We recommend..." (forbidden wording).

**Hard-stop test:**
**What you're testing:** The safety rule that stops the process for situations needing a real attorney.
**Steps:** On the children card, mark a child as having **special needs**.
**Expected result:** The quiz **stops** and shows a message referring the person to an attorney. No document is created.
**❌ Bug signs:** Quiz continues normally and lets the person buy a document anyway.

**Beneficiary name test:**
**What you're testing:** Validation that catches incomplete names.
**Steps:** In a name field, enter only a first name like "John".
**Expected result:** A warning appears saying the name looks incomplete.
**❌ Bug signs:** Partial name accepted with no warning.

### 5.2 Will Intake — `/will`
**What you're testing:** The form that collects all the information needed to build a will.
**Steps:**
1. Read the acknowledgment card, click Continue.
2. **About:** name, date of birth, city, whether you have minor children.
3. **Executor:** the person's name, their relationship to you, and a backup executor.
4. **Beneficiaries:** add 2 people. Give one 60% and one 40%. Then deliberately change them so they don't add up to 100% and try to continue.
5. **Guardian** (this card only appears if you said you have minor children): a guardian and a backup.
6. **Gifts:** organ donation choice, and any specific gifts.
7. **Review:** check the summary. Click "Edit Answers", then come back and click "Looks Good".
**Expected result:** Each card saves your answers. Beneficiary shares that don't total 100% are **blocked** with a clear message. The Guardian card only shows when relevant. The review summary correctly reflects everything you entered. Names from the quiz are pre-filled where possible. "Looks Good" takes you to checkout.
**❌ Bug signs:** Shares not totaling 100% are accepted, Guardian card missing when it should appear, review summary shows wrong or missing answers.

### 5.3 Will Checkout — `/will/checkout`
**What you're testing:** Paying for the will package.
**Steps:**
1. Check the price shown.
2. If this account already has a trust, watch for a conflict warning.
3. Pay with test card `4242 4242 4242 4242`.
4. In a separate attempt, try the declined card `4000 0000 0000 0002`.
**Expected result:** Price is **$400**. If a conflicting trust order exists, a clear conflict warning appears before payment. The success card sends you to `/will/success`. The declined card shows a payment error and creates no order.
**❌ Bug signs:** Wrong price, no conflict warning, declined card still creates an order, success page never loads.

### 5.4 Trust Intake — `/trust`
**What you're testing:** The longer (10-card) form that collects information for a trust.
**Steps:** Same general flow as the will, plus these specific checks:
- **Trustee card:** choose "Myself" and confirm your name auto-fills; choose "Someone else" and confirm it asks for a name.
- **Distribution age:** for minor beneficiaries, confirm you can pick 18, 21, 25, 30, or a custom age.
- **Power of Attorney:** confirm "Banking" is required, and that choosing "All of the above" selects every power.
- **Multi-state real estate:** confirm a warning appears about state-specific deeds.
- **Healthcare wishes = Yes:** confirm a text box appears.
**Expected result:** All the above behave as described. The review summary is accurate. "Looks Good" goes to trust checkout.
**❌ Bug signs:** Trustee name doesn't auto-fill, "All of the above" doesn't select everything, no multi-state warning.

### 5.5 Trust Checkout — `/trust/checkout`
**What you're testing:** Paying for the trust package.
**Steps:** Same as will checkout. Also check: if the account already has a will, watch for a conflict warning.
**Expected result:** Price is **$600**. Conflict warning shows if a will order exists. Test cards behave as in 5.3.
**❌ Bug signs:** Wrong price, missing conflict warning.

### 5.6 Attorney Review Add-On
**What you're testing:** The optional paid upgrade that sends the documents to a real attorney for a quality check.
**Steps:** During will or trust checkout, find the "Attorney Review (+$300)" option and add it.
**Expected result:** The order total goes up by $300, and the order appears in the attorney's review queue (see Section 10).
**❌ Bug signs:** Add-on doesn't change the price, order never shows up for the attorney.

### 5.7 Will Success Page — `/will/success`
**What you're testing:** The confirmation page after a successful will purchase, where documents are generated and downloaded.
**Steps:**
1. Complete a will purchase to land here.
2. Watch the progress steps: payment → document generation → ready.
3. Wait for documents to finish (the page checks every few seconds).
4. Try downloading each document.
**Expected result:** Three documents appear: Will, Power of Attorney, Healthcare Directive. They become downloadable once generated. "Sealed" PDFs ask for the vault passphrase before downloading; regular PDFs download directly. If attorney review was purchased, a 48-hour review timeline is shown. New accounts see a "set your password" prompt.
**❌ Bug signs:** Documents stuck on "generating" forever, download links broken, fewer than 3 documents.

### 5.8 Trust Success Page — `/trust/success`
**What you're testing:** The same confirmation page, for trusts.
**Steps:** Complete a trust purchase to land here.
**Expected result:** Four documents appear: Trust, Pour-Over Will, Power of Attorney, Healthcare Directive. Complex estates flagged during intake show an "under review" badge. A reference to the asset funding checklist is shown.
**❌ Bug signs:** Missing documents, no funding checklist reference.

---

## 6. The Vault — Secure Encrypted Storage

The Vault is a private online safe. It uses **end-to-end encryption (E2EE)**, which means the information is locked in a way that even EstateVault staff cannot read it — only the account owner (and trustees they choose) can.

### 6.1 Vault Setup — `/onboarding/vault-setup`
**What you're testing:** The one-time setup that turns on the encrypted vault. This must be done before the vault can be used.
**Steps:**
1. Create a 4-digit PIN.
2. Create a strong passphrase.
3. The system shows a **24-word recovery phrase** — write it down on paper.
4. Confirm the phrase by re-entering the words it asks for.
5. You're sent to the dashboard.
**Expected result:** Each step only continues when done correctly. The 24-word phrase is shown clearly and only once. After confirming, the vault is ready.
**❌ Bug signs:** Setup skips a step, recovery phrase not shown or shown more than once, confirmation accepts wrong words.
**⚠️ Important:** The recovery phrase is shown only once. If both the passphrase and the recovery phrase are lost, the vault data cannot be recovered by anyone. Make sure to save the phrase during testing.

### 6.2 Recover a Lost Passphrase — `/recover`
**What you're testing:** Getting back into the vault when the owner forgot their passphrase.
**Steps:**
1. Go to `/recover`.
2. Enter the 24-word recovery phrase from setup.
3. Set a new passphrase.
4. Try the old passphrase, then the new one.
5. In a separate attempt, enter a wrong/garbled recovery phrase.
**Expected result:** The correct phrase lets you set a new passphrase. The old passphrase stops working; the new one works. All existing vault items are still there. A wrong phrase shows a "Recovery failed" error.
**❌ Bug signs:** Old passphrase still works, vault items disappear, wrong phrase is accepted.

### 6.3 Subscription Gate
**What you're testing:** That the vault is only available to paying subscribers.
**Steps:** Log in as a client with no vault subscription and open the vault.
**Expected result:** An upgrade prompt appears ($99/year). Clicking upgrade goes to Stripe checkout.
**❌ Bug signs:** Non-subscriber gets full vault access for free.

### 6.4 PIN Setup and Unlock
**What you're testing:** The 4-digit PIN that locks the vault on each visit.
**Steps:**
1. First visit: enter a 4-digit PIN twice to set it.
2. Return later: enter the PIN to unlock.
3. Enter a wrong PIN.
4. Unlock the vault, then leave it idle for 10 minutes.
**Expected result:** PIN set successfully. Correct PIN opens the vault. Wrong PIN shows "Incorrect PIN." After 10 minutes idle, the vault auto-locks and asks for the PIN again.
**❌ Bug signs:** Vault opens with wrong PIN, never auto-locks.

### 6.5 Vault Categories — `/dashboard/vault`
**What you're testing:** Adding, viewing, and deleting items in the 8 storage categories: Estate Documents, Financial Accounts, Insurance, Digital Accounts, Physical Locations, Contacts, Business, Final Wishes.
**Steps (for at least 3 categories):**
1. Click a category card to open its list.
2. Click Add Item — the form fields change depending on the category (e.g. Financial Account asks for institution, account type, last 4 digits, notes).
3. Fill it in and save.
4. Click View on the item.
5. Use the Show/Hide toggle on a password or sensitive field.
6. Delete the item.
**Expected result:** Items save and appear in the list. The View modal shows all details. Show/Hide reveals and re-masks sensitive fields. Delete removes the item.
**❌ Bug signs:** Item doesn't save, sensitive fields always visible, delete doesn't work.

### 6.6 Vault Search
**What you're testing:** Searching vault items — done in a privacy-preserving way (the server only sees a scrambled version of the label, never the real text).
**Steps:** Add an item with a clear label, then search for that label.
**Expected result:** The matching item is found and its details display correctly.
**❌ Bug signs:** Search returns nothing for an item that exists, or shows items that don't match.

### 6.7 Document Upload (Estate Documents category only)
**What you're testing:** Uploading a PDF into the vault, which gets encrypted before storage.
**Steps:**
1. Drag a PDF onto the drop zone.
2. Add a label and document type.
3. Upload (limit is 20MB).
4. After upload, click Download.
5. Try uploading a file larger than 20MB.
6. Try uploading a non-PDF file.
**Expected result:** The PDF uploads and can be downloaded back (it opens normally). Files over 20MB are blocked with a message. Non-PDF files are blocked.
**❌ Bug signs:** Upload fails silently, downloaded file is corrupted, oversized or wrong-type files are accepted.

### 6.8 Trustees — `/dashboard/vault/trustees`
**What you're testing:** Naming up to 2 trusted people who can access the vault in an emergency.
**Steps:**
1. Add a trustee: name, email, relationship.
2. Send the invitation.
3. Watch the status.
4. Revoke a trustee.
**Expected result:** The trustee gets an invitation email. Status moves through "Pending invitation" → "Awaiting 72h" → "Active." Revoking removes them from the list.
**❌ Bug signs:** No invitation email, status stuck, revoke doesn't work.

### 6.9 Initialize Trustee Access — `/dashboard/vault/trustees/init`
**What you're testing:** A one-time security setup that lets trustees unlock the vault later *without* needing the owner's passphrase. (Technically it splits the vault key into shares.)
**Steps:**
1. Enter the 24-word recovery phrase.
2. Complete the setup.
3. Visit the page again.
**Expected result:** A "Trustee access initialized" confirmation appears. Visiting again shows an "already initialized" status. The owner's passphrase and recovery phrase still work normally.
**❌ Bug signs:** Setup errors out, can be run twice, breaks the owner's normal vault access.

### 6.10 Farewell Messages — `/dashboard/vault/farewell`
**What you're testing:** Recording personal video messages (or uploading PDFs) for family, to be released later.
**Steps:**
1. Click Record New Message and allow webcam/microphone access.
2. Record a 30–60 second message.
3. Add a title and recipient email.
4. Save.
5. Then delete a saved message.
**Expected result:** The message records and saves. It appears in the list with a "locked" status. **Important:** the Save action must not finish until the video has fully finished uploading. Delete removes it.
**❌ Bug signs:** Save completes while the upload bar is still moving (this means the video is lost — high-priority bug), message not added to list.

---

## 7. Trustee Flow — Access After the Owner Has Passed

These pages are used by the trustees the owner named, after the owner has died and been verified.

### 7.1 Trustee Unlock — `/trustee/unlock?token=[TOKEN]`
**What you're testing:** A trustee proving their identity to unlock the vault.
**Steps:**
1. Open the unlock link from the trustee's email.
2. The system emails a 6-digit one-time code (OTP).
3. Enter the correct code.
4. In a separate attempt, enter a wrong code.
5. Also try an old/expired link.
**Expected result:** The correct code sends the trustee to `/trustee/vault`. A wrong code shows an error and lets them retry. An expired link shows a "Token expired" message.
**❌ Bug signs:** Wrong code accepted, no OTP email arrives, expired link still works.

### 7.2 Trustee Vault Viewer — `/trustee/vault`
**What you're testing:** The read-only view trustees use to see the owner's vault.
**Steps:**
1. After unlocking, browse all 8 categories.
2. Open items and use the Show/Hide toggle.
3. Download a sealed document.
4. Leave the page idle for 30 minutes.
**Expected result:** All categories display the decrypted information. Sensitive fields toggle. Documents download and open. After 30 minutes idle, the session resets and the trustee must unlock again.
**❌ Bug signs:** Categories empty or won't decrypt, documents won't download, session never times out, trustee can edit (it should be read-only).

### 7.3 Trustee Farewell Access — `/farewell/[clientId]`
**What you're testing:** A trustee viewing the owner's recorded farewell messages.
**Steps:**
1. Submit a death certificate (a scan or photo).
2. After an admin verifies it, a 72-hour access window opens.
3. Enter the trustee email to view unlocked messages.
4. Play a video message.
5. Download a PDF message.
**Expected result:** After verification, the messages unlock. Videos play in the browser. PDFs download and open correctly.
**❌ Bug signs:** Messages stay locked after verification, video won't play, PDF is corrupted.

### 7.4 Owner Veto — `/farewell/owner-veto?token=[TOKEN]`
**What you're testing:** A safety check — if the owner is actually still alive when a trustee requests access, the owner can cancel that request.
**Steps:**
1. Trigger a trustee access request.
2. The owner receives an email with a veto link.
3. The owner opens the link and reviews the request.
4. The owner clicks "I'm alive — Cancel Access."
**Expected result:** The request status displays. Clicking cancel re-locks all farewell messages and sends the trustee a rejection email.
**❌ Bug signs:** Veto link broken, cancel doesn't re-lock the messages, trustee not notified.

---

## 8. Partner Portal — `pro.estatevault.us`

For law firms, advisors, and CPAs who resell the platform.

### 8.1 Partner Onboarding
**What you're testing:** The required setup steps a new partner must complete before going live.
**Steps:**
1. Log in as a fresh partner — you'll be forced into onboarding.
2. Complete: company info and license; vault customization (steps 2–4, if on the vault tier); training consent (step 6); review and launch (step 7).
3. Try skipping a required field.
**Expected result:** Each step requires its fields. Skipping a required field is blocked. Completing all steps lands you on `/pro/dashboard`.
**❌ Bug signs:** Can skip required steps, onboarding never completes.

### 8.2 Partner Dashboard — `/pro/dashboard`
**What you're testing:** The partner's home screen.
**Steps:** Log in and review the page.
**Expected result:** The firm's own logo, colors, and name show correctly. Practice stats display.
**❌ Bug signs:** EstateVault branding instead of the firm's, stats missing or zero when they shouldn't be.

### 8.3 Clients — `/pro/clients`
**What you're testing:** How a partner manages and invites their clients.
**Steps:**
1. View the client list.
2. Click Invite New Client to generate a referral link.
3. Open that link in a private/incognito window.
4. Sign up as a new client through it.
5. Go back to the partner account and check the client list.
6. Click a client to see their detail page.
**Expected result:** The invite link opens a partner-branded signup. The new signup appears in the partner's client list. The detail page shows the client's progress and orders.
**❌ Bug signs:** Invite link broken, new client not linked to the partner, detail page empty.

### 8.4 Vault Clients — `/pro/vault-clients`
**What you're testing:** Managing clients' vault subscriptions.
**Steps:** View the list of vault subscribers. Create a new vault client.
**Expected result:** The list shows subscription status. Creating a new vault client goes through Stripe checkout and emails the client to set up.
**❌ Bug signs:** List wrong, checkout fails, client never emailed.

### 8.5 Marketing — `/pro/marketing`
**What you're testing:** The library of marketing materials partners can download.
**Steps:** Browse templates and download a few.
**Expected result:** Files download successfully.

### 8.6 Referrals — `/pro/referrals`
**What you're testing:** The partner's referral link and stats.
**Steps:** Copy the referral link and view the stats.
**Expected result:** Link copies, stats display.

### 8.7 Revenue — `/pro/revenue`
**What you're testing:** The partner's earnings dashboard.
**Steps:** View the chart, change the date range, check the commission splits and payout history.
**Expected result:** Chart updates with the date range. Splits match the rules: Standard partner earns $300/will and $400/trust; Enterprise earns $350/will and $450/trust.
**❌ Bug signs:** Wrong split amounts, chart doesn't update.

### 8.8 Sales Sub-Portal — `/pro/sales/*`
**What you're testing:** The partner's own sales pipeline and commission tools.
**Steps:** Open the pipeline (a Kanban board), drag a deal between columns, then reload the page.
**Expected result:** The deal stays in the column you dropped it in after reload.
**❌ Bug signs:** Deal jumps back after reload.

### 8.9 Training — `/pro/training`
**What you're testing:** The required partner training course and exam.
**Steps:** Complete Module 1, confirm Module 2 unlocks, finish all modules, then take the exam.
**Expected result:** Modules unlock in order. Passing the exam (80% or higher) marks training complete on the dashboard.
**❌ Bug signs:** Modules unlock out of order, exam score calculated wrong.

### 8.10 Settings — `/pro/settings`
**What you're testing:** Branding and account settings for the partner.
**Steps:** Upload a logo, set custom colors, connect a Stripe account, add a team member email.
**Expected result:** The new logo and colors appear across the client-facing portal. Stripe connects. The team member is added.
**❌ Bug signs:** Branding changes don't take effect, Stripe connection fails.

---

## 9. Sales / Admin Portal — `sales.estatevault.us`

For EstateVault's own sales reps and internal staff.

### 9.1 Sales Dashboard — `/sales/dashboard`
**What you're testing:** The overview screen for sales reps and admins.
**Steps:** Log in and review pipeline, commissions, and assigned partners.
**Expected result:** All sections load with data.

### 9.2 Pipeline — `/sales/pipeline`
**What you're testing:** The org-wide sales pipeline board.
**Steps:** Drag a deal between stages, then reload.
**Expected result:** The stage change is saved.
**❌ Bug signs:** Change not saved after reload.

### 9.3 Partner Commissions — `/sales/commission`
**What you're testing:** The commission breakdown for sales staff.
**Steps:** Review the commission figures and the month-to-date breakdown table.
**Expected result:** The default commission rate for salespeople is **50%**. The breakdown table includes a Status column.
**❌ Bug signs:** Wrong default rate, missing Status column.

### 9.4 Partners — `/sales/partners` (Admin only)
**What you're testing:** Admin management of all partner firms.
**Steps:** View all partners, filter by status (pending, active, suspended), open a partner.
**Expected result:** Filtering works; the partner detail page shows full info.

### 9.5 New Partner — `/sales/new-partner`
**What you're testing:** Creating and inviting a new partner firm.
**Steps:** Fill in the partner form and submit.
**Expected result:** The partner is created and invited.

### 9.6 Farewell Verification — `/sales/farewell-verification` (Admin only)
**What you're testing:** Admin review of death certificates before farewell messages are released.
**Steps:** Open a pending request, review the uploaded death certificate, approve or reject it.
**Expected result:** Approving opens trustee access and sends the trustee an email. Rejecting keeps everything locked.
**❌ Bug signs:** Approval doesn't notify the trustee, rejected request still grants access.

### 9.7 Sidebar Label
**What you're testing:** That the sidebar correctly identifies which portal you're in.
**Steps:** Log in once as an admin, once as a sales rep.
**Expected result:** Admin sees the sidebar labeled **"Admin Portal."** Sales rep sees **"Sales Portal."**
**❌ Bug signs:** Wrong label for the role.

---

## 10. Attorney Portal — `admin.estatevault.us/attorney`

For review attorneys who quality-check client documents.

### 10.1 Attorney Dashboard — `/attorney`
**What you're testing:** The attorney's landing page.
**Steps:** Log in as a review attorney.
**Expected result:** You're automatically sent to `/attorney/dashboard`.

### 10.2 Review Queue — `/attorney/reviews`
**What you're testing:** The queue of client orders waiting for attorney review.
**Steps:**
1. View the queue (orders where attorney review was purchased).
2. Open an order and read the client's intake answers and draft documents.
3. Add comments.
4. Mark it "Approved" or "Needs Revision."
**Expected result:** The queue lists the right orders. You can read intake and drafts. After you approve or flag it, the client gets an email notification.
**❌ Bug signs:** Orders missing from queue, can't view drafts, client not notified.

### 10.3 Attorney Pipeline (Kanban view)
**What you're testing:** The drag-and-drop board view of reviews.
**Steps:** Drag review cards between columns.
**Expected result:** Cards are compact, there's no awkward horizontal scrolling, and moves are saved.
**❌ Bug signs:** Horizontal scroll bar, moves not saved.

### 10.4 Attorney Signup — `/partners/attorneys/signup`
**What you're testing:** The public application form for attorneys wanting to join the network.
**Steps:** Fill in name, firm, license number, and submit.
**Expected result:** The application submits and the status is set to "pending verification."

### 10.5 Welcome Page — `/partners/attorneys/welcome`
**What you're testing:** The landing page for newly applied attorneys.
**Steps:** As a new attorney, review the page and click "Ready."
**Expected result:** The page explains the program; clicking "Ready" puts the attorney in a waiting state for admin approval.

---

## 11. Affiliate Program

For referral partners who earn commission for sending traffic.

### 11.1 Affiliate Signup — `/affiliate-signup`
**What you're testing:** Registering as an affiliate.
**Steps:** Fill in the form, accept the terms, complete the Stripe Connect onboarding.
**Expected result:** After Stripe is complete, the affiliate's status becomes active.
**❌ Bug signs:** Status stuck on pending after Stripe finishes.

### 11.2 Affiliate Dashboard — `/affiliate`
**What you're testing:** The affiliate's tracking dashboard — the most important test is that a referral actually earns a commission.
**Steps:**
1. Copy the affiliate's unique referral link (looks like `/a/[code]`).
2. Open it in a private/incognito window.
3. Sign up as a brand-new client through that link.
4. Place an order with a test card.
5. Go back to the affiliate dashboard.
**Expected result:** Clicks go up by 1, conversions go up by 1, and earnings increase by the commission amount. Payout history shows the entry.
**❌ Bug signs:** Click or conversion not counted, no commission credited.

### 11.3 Referral Link — `/a/[code]`
**What you're testing:** That the short referral link works.
**Steps:** Open the link directly.
**Expected result:** It quietly records the click and redirects to the homepage.
**❌ Bug signs:** Link errors out or doesn't redirect.

---

## 12. Things to Check on Every Test Run

### 12.1 Pricing — These Must NEVER Change
| Item | Correct Price |
|------|---------------|
| Will Package | $400 |
| Trust Package | $600 |
| Attorney Review Add-On | $300 |
| Amendment | $50 |
| Vault Subscription | $99/year |

If you ever see a different price anywhere, that is a **high-priority bug**.

### 12.2 Forbidden Language
The platform must **never** show clients:
- "We recommend..." — it must say "Based on your answers..."
- The word "death" in client-facing text
- Anything that sounds like legal advice

### 12.3 Hard Stops
These situations must **stop** document creation and refer the person to an attorney — with no way to bypass:
- A dependent or family member with special needs
- A request for an irrevocable trust

### 12.4 Plan Conflict
- If the account already has a will, the trust checkout must show a conflict warning.
- If the account already has a trust, the will checkout must show a conflict warning.

### 12.5 Emails to Verify
Check that each of these emails actually sends and looks correct:
- Signup confirmation
- Password reset
- Order confirmation
- "Documents ready"
- Trustee invitation
- Trustee one-time code (OTP)
- Farewell release notification
- Owner veto email
- Affiliate payout
- Contact form submission
- Partner "request access" confirmation

### 12.6 Mobile / Tablet
Re-test these key flows on a phone (or with your browser window made narrow): Homepage, Quiz, Will and Trust intake, Dashboard, Vault. Buttons must be easy to tap, text must be readable, and nothing should scroll sideways.

---

## 13. How to Report a Bug

Log every bug you find in the shared bug-tracking sheet, filling in these columns:

1. **Priority**
2. **Bug ID**
3. **Title**
4. **Description**
5. **Expected**
6. **Page/Panel**

**Bug tracker:** [Open Bug Tracking Sheet](https://excel.cloud.microsoft/open/onedrive/?docId=1299A47546CADAAF%21s21edd17b410f4cc293efe01f933114f3&driveId=1299A47546CADAAF)

---

## 14. Quick-Reference Test Matrix

| Area | The Most Critical Tests |
|------|------------------------|
| Auth | Each role logs in only on its correct site; wrong-host login is blocked |
| Quiz | All 10 cards work; hard stop triggers on special needs |
| Will | Beneficiary shares must total 100%; review summary is accurate |
| Trust | Trustee picker; POA "all of the above"; minor distribution age |
| Checkout | $400 will, $600 trust; plan-conflict warning; declined card creates no order |
| Success Pages | Documents generate and download; sealed PDFs require the passphrase |
| Vault Setup | PIN → passphrase → 24-word phrase → confirm → dashboard |
| Recovery | Recovery phrase + new passphrase replaces the old passphrase |
| Vault | PIN unlock, 10-minute auto-lock, drag-drop PDF, encrypted search |
| Trustee Init | Recovery phrase sets up trustee access; can't run twice |
| Trustees | Invite → 72-hour wait → active |
| Trustee Unlock | Email link → one-time code → vault viewer |
| Trustee Vault | All 8 categories decrypt; 30-minute idle reset; read-only |
| Farewell (Owner) | Save must not finish before the video upload finishes |
| Farewell (Trustee) | Certificate verified → 72-hour access → videos play, PDFs decrypt |
| Owner Veto | Veto link cancels access, re-locks messages, notifies trustee |
| Partner | 7-step onboarding; firm branding applied; client list updates |
| Sales | Pipeline drag-drop is saved; 50% default commission rate |
| Attorney | Review queue works; approve/revise notifies the client |
| Affiliate | `/a/[code]` → signup → order results in a commission |

---

**End of Guide.** Work through it section by section. Do not skip the wrong-host login tests or the encrypted vault recovery and trustee flows — those are where the most serious bugs hide.
