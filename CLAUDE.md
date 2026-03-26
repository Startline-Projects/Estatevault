# EstateVault — Project Brief for Claude Code

## What We Are Building
EstateVault is a B2B2C white-label estate planning platform. It has two surfaces:
- **estatevault.com** — consumer-facing landing page and document creation flow
- **pro.estatevault.com** — professional partner portal (onboarding, dashboard, client management)

## Tech Stack (use this exactly)
- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend:** Next.js API routes + Supabase (Postgres database + auth)
- **Payments:** Stripe
- **AI:** Anthropic Claude API (claude-sonnet-4-5)
- **Email:** Resend
- **File Storage:** Supabase Storage
- **Deployment:** Vercel

## Brand
- Primary color: Navy #1C3557
- Accent color: Gold #C9A84C
- Background: White #FFFFFF
- Text: Charcoal #2D2D2D
- Font: Inter (import from Google Fonts)
- Voice: Warm, simple, trustworthy. Never use the word "death." Frame everything as protection.

## Core Rules (never break these)
1. The platform NEVER gives legal advice. It generates documents based on client answers.
2. All quiz result language must be framed as "Based on your answers..." — never "We recommend..."
3. Every client must sign an acknowledgment form before any document is generated.
4. Hard stop conditions (special needs dependent, irrevocable trust indicated) must halt
   document generation completely and route to attorney referral. These are hardcoded — 
   no user action can override them.
5. All pricing is fixed:
   - Will Package: $400
   - Trust Package: $600
   - Attorney Review Add-On: $300 (flows directly to attorney — EstateVault earns $0)
   - Document Amendment: $50
6. Partner revenue splits:
   - Standard partner: earns $300/will, $400/trust
   - Enterprise partner: earns $350/will, $450/trust
   - EstateVault keeps the remainder

## Fixed Pricing — Do Not Make Configurable
Prices are set by EstateVault. Partners cannot change them. Display them as-is.

## User Types
1. **End Client** — creates will/trust, manages vault
2. **Professional Partner** — white-labels the product, manages clients, earns revenue
3. **Sales Representative** — creates partner accounts, monitors onboarding
4. **Review Attorney** — reviews complex client files before document delivery
5. **Platform Admin** — full system access, template management, compliance

## The Vault Feature
Every client account includes a secure encrypted digital vault for storing:
- Estate planning documents (auto-populated from purchases)
- Insurance policies
- Financial account details (masked after entry)
- Digital account credentials (social media, email, banking logins)
- Physical document locations
- Important contacts
- Final personal wishes

Vault access requires a separate PIN from the account password.
Vault Trustee: client can designate 1-2 people for emergency access 
(72-hour review period + identity verification before access granted).

## Project Structure
We build in phases. Do not build ahead of the current phase unless explicitly told to.

### Phase Order:
- Phase 1:  Project setup + Consumer landing page
- Phase 2:  Card-based quiz flow
- Phase 3:  Supabase schema + authentication
- Phase 4:  Will creation flow + Stripe checkout
- Phase 5:  Trust creation flow + attorney review upsell
- Phase 6:  Client portal (Documents + Vault + Life Events)
- Phase 7:  Partner portal login + 7-step onboarding
- Phase 8:  Partner dashboard + sidebar + client management
- Phase 9:  Sales rep admin portal
- Phase 10: Marketing tools hub
- Phase 11: Claude API integration (quiz personalization + document generation)
- Phase 12: Stripe payouts + revenue splits

## Current Phase
**PHASE 1 — Project Setup + Consumer Landing Page**

## Database
We use Supabase. Connection string will be provided when needed.
Do not hardcode any credentials. Use environment variables for all secrets.

## Environment Variables Pattern
Store all secrets in .env.local — never commit this file.
Always add new env vars to a .env.example file with placeholder values.

## Code Quality Rules
- TypeScript strict mode — no `any` types
- Every component in its own file under /components
- Pages in /app directory (Next.js App Router)
- API routes in /app/api
- Database queries in /lib/db
- All forms must have loading states and error handling
- Mobile-first responsive design on every page
