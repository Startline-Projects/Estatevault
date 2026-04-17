# EstateVault — Core Context

## What We Are Building
B2B2C white-label estate planning platform.
- **estatevault.com** — consumer landing + document creation
- **pro.estatevault.com** — professional partner portal

## Tech Stack
- Next.js 14 (App Router), TypeScript, Tailwind CSS
- Supabase (Postgres + auth), Stripe, Resend, Supabase Storage
- AI: Anthropic Claude API (`claude-sonnet-4-5`)
- Deployment: Vercel

## Brand
- Navy `#1C3557` · Gold `#C9A84C` · White `#FFFFFF` · Charcoal `#2D2D2D`
- Font: Inter (Google Fonts)
- Voice: Warm, simple, trustworthy. Never say "death." Frame everything as protection.

## Core Rules (never break)
1. Platform NEVER gives legal advice — generates documents from answers only.
2. Quiz results: "Based on your answers…" — never "We recommend…"
3. Clients must sign acknowledgment before any document is generated.
4. Hard stops (special needs dependent, irrevocable trust) halt generation → attorney referral. Hardcoded, no override.
5. Fixed pricing — partners cannot change these:
   - Will Package: $400 · Trust Package: $600
   - Attorney Review Add-On: $300 (100% to attorney)
   - Amendment: $50
6. Revenue splits:
   - Standard partner: $300/will, $400/trust
   - Enterprise partner: $350/will, $450/trust

## User Types
- End Client · Professional Partner · Sales Rep · Review Attorney · Platform Admin

## Secrets & Env
- All secrets in `.env.local` — never commit it.
- Add placeholders to `.env.example` for every new var.
