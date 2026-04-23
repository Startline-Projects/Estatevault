# EstateVault — Vault Feature Design Brief

## What the Vault Is

The **Digital Vault** is a secure, private storage space inside the client's EstateVault dashboard. It lets users organize everything their loved ones will need after they're gone — financial accounts, insurance policies, digital passwords, important contacts, and more.

It is **not** just document storage. It is a living, structured record of a person's entire financial and personal life — organized, encrypted, and accessible to designated trustees at death.

The vault is a **premium feature** — sold separately from the will/trust packages.

---

## Vault Pricing

| Plan | Price | Notes |
|------|-------|-------|
| Vault Subscription | Recurring (monthly or annual) | Separate from will/trust purchase |
| Included with Trust Package | Bundled | Trust buyers get vault free |

Checkout route: `/checkout/vault-subscription`

---

## Current Tech Stack Context

- **Framework:** Next.js 14, App Router, TypeScript, Tailwind CSS
- **Auth/DB:** Supabase (Postgres + Auth)
- **Storage:** Supabase Storage (for uploaded documents, farewell videos)
- **Payments:** Stripe
- **Brand Colors:** Navy `#1C3557` · Gold `#C9A84C` · White `#FFFFFF` · Charcoal `#2D2D2D`
- **Font:** Inter

---

## Existing Vault Routes

```
/dashboard/vault              ← Main vault page (category grid + items)
/dashboard/vault/trustees     ← Manage who can access vault at death
/dashboard/vault/farewell     ← Record or upload farewell video/message
```

---

## Database Tables

### `vault_items`
Stores all vault entries. Flexible JSONB `data` column holds category-specific fields.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → profiles |
| category | text | One of 8 categories |
| title | text | User-defined label |
| data | jsonb | Flexible key/value payload |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `vault_trustees`
Who can access the vault if the owner dies.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| vault_owner_id | uuid | FK → profiles |
| trustee_name | text | |
| trustee_email | text | |
| relationship | text | e.g. "Spouse", "Child" |
| access_level | text | e.g. "full", "read-only" |
| invited_at | timestamptz | |
| accepted_at | timestamptz | Null until they accept |

---

## Vault Categories (8 Total)

Each category has its own icon, color accent, and field schema.

| # | Category | What it Stores |
|---|----------|----------------|
| 1 | Estate Documents | Will, trust, deeds, titles |
| 2 | Financial Accounts | Banks, brokerages, retirement accounts |
| 3 | Insurance Policies | Life, health, auto, home, umbrella |
| 4 | Digital Accounts | Email, social media, crypto, subscriptions |
| 5 | Physical Locations | Safe, safe-deposit box, storage unit |
| 6 | Important Contacts | Attorneys, CPAs, doctors, clergy |
| 7 | Business Interests | Ownership stakes, partnerships, LLCs |
| 8 | Final Wishes | Funeral preferences, organ donation, personal messages |

---

## API Routes (Existing)

```
GET/POST   /api/vault/items              ← List or create vault items
PUT/DELETE /api/vault/items/[id]         ← Update or delete a specific item
GET/POST   /api/vault/pin               ← Get or set vault PIN
GET/POST   /api/vault/trustees          ← List or invite trustees
GET/POST   /api/vault/farewell          ← Get or save farewell message/video
POST       /api/vault/upload-document   ← Upload file to vault
GET        /api/vault/download-document ← Download file from vault
```

---

## Vault PIN Security

The vault has a **secondary PIN layer** on top of Supabase auth. Users set a 4–6 digit PIN. Accessing the vault in the same session requires entering the PIN first.

- PIN is hashed before storage
- PIN re-prompt on session expiry or after 30 min idle
- PIN reset via email verification

---

## Trustee Access Flow

1. Owner adds trustee (name + email + relationship + access level)
2. System sends invite email (via Resend)
3. Trustee accepts invite → creates an account or links existing
4. Trustee **cannot** access vault until owner's death is verified
5. Death verification: owner's attorney or designated verifier submits a death verification form
6. Platform admin approves → trustees gain read-only access to vault contents

---

## Farewell Feature

Located at `/dashboard/vault/farewell`.

Two modes:
1. **Record** — in-browser video recording (FarewellRecorder component)
2. **Upload** — upload a pre-recorded video (FarewellUploader component)

Video stored in Supabase Storage. Only trustees can access after death verification.

---

## Key UI Patterns (Existing)

- **Category Grid:** 8 cards in a 2×4 or 4×2 grid with icon + item count
- **Item List:** Within each category — title, summary, edit/delete actions
- **Add Item Modal:** Form varies by category (JSONB fields map to form fields)
- **Completion Meter:** Progress bar showing % of vault categories filled
- **Subscription Banner:** Shown if vault subscription is not active

---

## App Design Goals for New Vault Build

### Core Experience
- Feel like a **personal safe** — serious, private, organized
- Dark-mode-friendly (navy background, gold accents)
- Mobile-first — users may fill this in on a phone
- Never feel overwhelming — guide users one category at a time

### Key Screens to Design

1. **Vault Home** — Category grid with completion status per category, overall progress, quick-add CTA
2. **Category View** — List of items in selected category, empty state with prompt, add button
3. **Add/Edit Item** — Form sheet (slide-up on mobile), fields vary by category
4. **Trustees Page** — List of trustees, invite flow, pending invites, access level badges
5. **Farewell Page** — Record/upload video, preview playback, re-record option
6. **Vault PIN Setup/Entry** — Numpad style, 4–6 digits, PIN hint option
7. **Death Verification Status** — Shown to trustees post-invite (what they see before access granted)
8. **Subscription Upsell** — Shown to non-subscribers, lists vault features, CTA to Stripe checkout

### Design Constraints
- Use brand colors: Navy `#1C3557`, Gold `#C9A84C`, White, Charcoal `#2D2D2D`
- Font: Inter
- Component library: Tailwind CSS + shadcn/ui patterns
- No heavy animation — keep it fast and trustworthy-feeling
- Empty states: warm, encouraging (e.g. "Start with your bank accounts — it takes 2 minutes")

### Content/Copy Rules
- Never say "death" — say "when your trustees need access" or "after you're gone"
- Never say "if you die" — say "to protect your loved ones"
- Frame vault as **protection**, not morbidity

---

## Vault Item Field Schemas (Per Category)

### Financial Accounts
```
institution_name, account_type, account_number_last4, routing_number, 
online_login_url, username_hint, notes
```

### Insurance Policies
```
company_name, policy_type, policy_number, coverage_amount, 
agent_name, agent_phone, agent_email, premium_amount, renewal_date
```

### Digital Accounts
```
platform_name, account_type, username, email_used, 
password_hint, two_factor_method, recovery_code_location, notes
```

### Physical Locations
```
location_type (safe/box/storage), location_description, 
address, combination_hint, key_location, what_is_stored
```

### Important Contacts
```
name, role (attorney/CPA/doctor/clergy/other), firm_name, 
phone, email, address, notes
```

### Business Interests
```
business_name, business_type, ownership_percent, 
ein_or_tax_id, registered_state, attorney_name, notes
```

### Final Wishes
```
funeral_preference (burial/cremation/other), 
service_preferences, organ_donation (yes/no/registered), 
personal_message (text or video link), special_requests
```

### Estate Documents
```
document_type, document_name, file_upload (Supabase Storage URL), 
date_signed, attorney_name, notes
```

---

## Integration Points

- **Auth:** Supabase session — all vault routes gated behind login
- **Payments:** Stripe checkout for vault subscription — `/checkout/vault-subscription`
- **Email:** Resend — trustee invite emails, death verification notifications
- **Storage:** Supabase Storage — uploaded documents, farewell videos
- **PIN:** Stored hashed in `profiles.vault_pin_hash` (or separate table)

---

## Out of Scope for This App

- AI-assisted vault completion (future feature)
- Multi-language support
- Shared vault editing (trustees are read-only, never write)
- Third-party financial account linking (no Plaid integration)
