# My Family Vault — Mobile App UI Spec

> **Purpose:** UI-only mobile prototype specification for the "My Family Vault" feature of EstateVault. No backend logic, no real data — static/mock UI only.

---

## 1. Overview

**Screen Name:** My Family Vault
**Tagline:** "Everything your family needs — secured and organized."
**User Role:** End Client (signed-in)
**Platform Target:** Mobile (iOS / Android responsive design, 375px baseline)

The vault is a secure dashboard where a logged-in user can view, add, and manage categorized personal/estate information. Each category is represented as a tappable card that leads to a detail/list screen.

---

## 2. Design System

### Color Palette
| Token | Hex | Usage |
|-------|-----|-------|
| Navy (Primary) | `#1C3557` | Sidebar, headers, primary text |
| Gold (Accent) | `#C9A84C` | Badges, highlights, CTAs |
| Background | `#FFFFFF` | Page background |
| Surface / Card | `#F3F5F9` | Card backgrounds (light blue-grey) |
| Text Primary | `#2D2D2D` | Charcoal body text |
| Text Muted | `#6B7280` | Subtext, "Empty" labels |
| Success Green | `#22C55E` | "Active" subscription badge |
| Success Tint | `#E8F7EC` | Subscription banner background |

### Typography
- **Font family:** Inter (Google Fonts)
- **H1 (Page title):** 24–28px, weight 700
- **Subtitle:** 14px, weight 400, muted
- **Card title:** 16px, weight 600
- **Card subtext:** 13px, weight 400, muted
- **Button:** 14px, weight 600

### Spacing & Radius
- Card radius: 12px
- Button radius: 24px (pill)
- Page padding: 16px horizontal on mobile
- Grid gap: 12px

---

## 3. Layout Structure (Mobile)

```
┌─────────────────────────────┐
│  TOP APP BAR                │  ← Hamburger + Logo + Avatar
├─────────────────────────────┤
│  Page Title + Subtitle      │
│  "Manage Emergency Access"  │  ← Secondary button (full-width on mobile)
├─────────────────────────────┤
│  Subscription Banner        │  ← Green "Active" pill + renewal date
├─────────────────────────────┤
│                             │
│  VAULT CATEGORY GRID        │  ← 2 columns on mobile
│  (9 cards, 2-col layout)    │
│                             │
├─────────────────────────────┤
│  BOTTOM NAV (5 tabs)        │  ← Home / Docs / Vault / Life / Settings
└─────────────────────────────┘
```

### Navigation
- **Desktop:** Fixed left sidebar (as shown in screenshot)
- **Mobile:** Replace sidebar with bottom tab bar + top app bar with hamburger menu
- **Active tab:** "My Vault" (highlighted in gold or with gold accent indicator)

### Sidebar / Bottom Nav Items
1. Home (house icon)
2. My Documents (document icon)
3. My Vault (vault / lock icon) — **active**
4. Life Events (calendar icon)
5. Settings (gear icon)

Footer of sidebar (or Settings screen on mobile):
- User name: "AMIR YASEEN"
- Sign Out link

---

## 4. Top Section

### 4.1 Page Header
- **Title:** "My Family Vault"
- **Subtitle:** "Everything your family needs — secured and organized."
- **Action Button (top-right on desktop / below title on mobile):**
  - Label: "Manage Emergency Access"
  - Style: Outlined pill button, navy border, navy text
  - On tap: opens Emergency Access management screen (out of scope — placeholder)

### 4.2 Subscription Status Banner
- Full-width card, light green background (`#E8F7EC`)
- **Left side:**
  - Green "Active" pill badge (rounded, white text, green fill)
  - Text: "Vault Subscription"
  - Sub-text: "Renews April 16, 2027"
- **Right side (desktop) / wrap to new line (mobile):**
  - "Free amendments" and "Farewell messages" — separated by a vertical divider `|`
  - Muted grey text

---

## 5. Vault Category Grid (Primary Content)

Grid of 9 category cards. On mobile: **2 columns**; on tablet/desktop: **4 columns**.

Each card shows:
- **Icon** (top-left, ~32px, navy-tinted)
- **Title** (bold, 16px)
- **Subtext / Count** (muted, 13px) — either an item count ("2 items") or the word "Empty"
- On tap: navigates to the category detail screen

### 5.1 Full Card List

| # | Card Title | Icon | Default State | Description / Purpose |
|---|-----------|------|---------------|----------------------|
| 1 | Estate Documents | Document / file icon | **2 items** | Wills, trusts, powers of attorney. Auto-populated from purchases. |
| 2 | Financial Accounts | Bank / building icon | Empty | Bank accounts, investment accounts. Account numbers are masked after entry. |
| 3 | Insurance Policies | Shield icon | Empty | Life, health, property, auto insurance details. |
| 4 | Digital Accounts | Key icon | Empty | Social media, email, banking logins and credentials. |
| 5 | Physical Locations | Location pin icon | Empty | Where physical documents, safes, and keys are stored. |
| 6 | Important Contacts | Person / silhouette icon | Empty | Attorneys, doctors, executors, trusted family members. |
| 7 | Business Interests | Briefcase icon | Empty | Ownership stakes, partnerships, LLC memberships. |
| 8 | Final Wishes | Note / document icon | Empty | Funeral preferences, organ donation, personal wishes. |
| 9 | Farewell Messages | Video camera icon | "Video messages for loved ones" | Recorded video/audio messages. |

### 5.2 Card States (for prototype)
Prototype should show **three visual states** so designers can preview styling:
1. **Filled** — shows item count (e.g. "2 items") in muted grey below title
2. **Empty** — shows the word "Empty" in muted grey below title
3. **Feature hint** — shows a short description (e.g. "Video messages for loved ones") in muted grey below title

---

## 6. Category Detail Screen (Secondary — for prototype completeness)

When a user taps a category card, open a detail screen with:

### 6.1 Structure
- Back button (top-left, navy chevron)
- Screen title (category name)
- "+ Add New" floating action button (gold, bottom-right)
- List of existing items OR empty state

### 6.2 Empty State
- Centered illustration/icon (category-matched)
- Message: "Nothing here yet."
- Subtext: "Tap the + button to add your first [category name singular]."
- Primary CTA: "Add [Item]" (gold pill button)

### 6.3 Filled State (example: Estate Documents)
- List of item rows, each showing:
  - Document icon
  - Document title (e.g. "Last Will & Testament")
  - Date added / updated
  - Chevron-right for details
- Tap row → view/edit detail screen (stub for prototype)

---

## 7. Manage Emergency Access Screen (Secondary)

Triggered by the "Manage Emergency Access" button.

### 7.1 Purpose
Designate 1–2 **Vault Trustees** who can request emergency access to the vault.

### 7.2 Screen Contents
- Header: "Emergency Access"
- Description paragraph: "Designate up to 2 people who can request emergency access to your vault. Access requires a 72-hour review period and identity verification."
- List of current trustees (0, 1, or 2 entries)
  - Each entry: avatar, name, relationship, email, "Remove" action
- "+ Add Trustee" button (disabled if 2 trustees already added)
- Security note: "Vault access requires a separate PIN from your account password."

---

## 8. Interaction Notes (for prototype)

| Element | Interaction |
|---------|-------------|
| Card tap | Navigate to category detail screen |
| "Manage Emergency Access" button | Navigate to Emergency Access screen |
| Bottom nav tabs | Switch top-level screens (stub other tabs) |
| Hamburger / avatar | Open side drawer with Sign Out (optional) |
| Scroll behavior | Page scrolls vertically; subscription banner and header scroll with content |

No real data fetching, no forms need to submit — this is a static UI prototype.

---

## 9. Mobile Responsive Rules

- **375px (iPhone SE baseline):** 2-column card grid, single-column banner
- **768px (tablet):** 3-column card grid
- **1024px+ (desktop, reference screenshot):** 4-column card grid with left sidebar
- All tap targets minimum 44×44px
- Safe-area insets respected (top notch, bottom home indicator)

---

## 10. Screens to Include in Prototype

1. **My Family Vault (Dashboard)** — primary screen (from screenshot)
2. **Category Detail — Filled** (using "Estate Documents" as example with 2 dummy items)
3. **Category Detail — Empty** (using "Financial Accounts" as example)
4. **Manage Emergency Access** (empty state + state with 1 trustee)
5. **Bottom Nav / Side Menu** navigation stubs for other tabs (can be blank placeholders)

---

## 11. Assets Needed (icons)

All icons should be line-style, navy-tinted, ~32px:
- Document / file
- Bank / columned building
- Shield
- Key
- Location pin
- Person silhouette
- Briefcase
- Note / sticky-note
- Video camera
- House (nav)
- Calendar (nav)
- Gear (nav)
- Lock / vault (nav active)
- Chevron-right
- Plus (+)
- Hamburger menu

Icon set suggestion: **Lucide** or **Heroicons** (outline style).

---

## 12. Out of Scope

- Authentication / sign-in screens
- Actual document upload / storage
- Stripe or billing flows
- Real backend data
- Form validation logic
- Dark mode (light mode only for v1 prototype)

---

## 13. Deliverable Summary for SkillUI

Please generate a **mobile-first, light-mode, UI-only prototype** with:
- The 5 screens listed in Section 10
- Navy/Gold EstateVault brand palette from Section 2
- Inter font family
- Tappable cards that route to stubbed detail screens
- Realistic placeholder content (names, dates, item counts) matching the "Description" column in Section 5.1
- Bottom tab navigation on mobile breakpoints

No functionality beyond navigation — all data is static.
