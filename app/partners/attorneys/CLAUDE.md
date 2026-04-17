# Attorney Partner Page — Context

## What this page is
`/partners/attorneys` — marketing/sales page for attorney white-label partners.
Sections: Nav · Hero · Logo bar · Problem/Solution · How it works · Demo · Pricing · Earnings calculator · Upsell (complex cases) · Testimonials · FAQ · Compliance · CTA · Footer.

## Key files
- `page.tsx` — single `'use client'` page component (~1270 lines)
- `attorneys.module.css` — all styles (CSS Modules)

## Pricing tiers displayed
- **Standard:** $1,200 one-time · 3 seats · $300/will + review fee · $400/trust + review fee
- **Professional:** $6,000 one-time · 10 seats · $350/will · $500/trust · priority placement
- **Enterprise:** Custom pricing · multi-firm/location · SLA

## Attorney-specific features
- Attorneys set their own review fee ($150–$1,500) — 100% goes to them
- Attorney name + bar number on every approved document
- Complex cases (irrevocable trust, special needs, Medicaid, business succession) hard-stop → routed to attorney as full engagements
- Promo code `TPFP` waives platform fee (built into page state)

## Review network
Separate page at `/partners/attorneys/review-network` (linked from nav as "Review Network").

## Signup flow
Links to `/partners/attorneys/signup?tier=standard` or `?tier=professional` (with optional `&promo=TPFP`).

## Animations
IntersectionObserver reveal on scroll — refs stored in `revealRefs`, class `styles.revealIn` applied on intersect.

## Michigan compliance
Templates built with Michigan attorneys, compliant with EPIC (Michigan Estates and Protected Individuals Code).
