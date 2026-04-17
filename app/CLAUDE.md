# Frontend Rules — /app

## Code Quality
- TypeScript strict mode — no `any` types
- Every component in its own file under `/components`
- Pages in `/app` (App Router) · API routes in `/app/api` · DB queries in `/lib/db`
- All forms: loading states + error handling
- Mobile-first responsive on every page

## Phase Order (do not build ahead unless told)
1. Project setup + landing page
2. Quiz flow
3. Supabase schema + auth
4. Will flow + Stripe
5. Trust flow + attorney review upsell
6. Client portal (Documents + Vault + Life Events)
7. Partner portal login + onboarding
8. Partner dashboard + client management
9. Sales rep admin portal
10. Marketing tools hub
11. Claude API integration
12. Stripe payouts + revenue splits

**Current phase: PHASE 1**

## Vault Feature
Encrypted vault per client: estate docs, insurance, financial accounts (masked), digital credentials, physical locations, contacts, final wishes.
- PIN separate from account password
- Trustee: 1–2 people, 72h review + identity verification before access
