<!-- VERCEL BEST PRACTICES START -->
## Best practices for developing on Vercel

These defaults are optimized for AI coding agents (and humans) working on apps that deploy to Vercel.

- Treat Vercel Functions as stateless + ephemeral (no durable RAM/FS, no background daemons), use Blob or marketplace integrations for preserving state
- Edge Functions (standalone) are deprecated; prefer Vercel Functions
- Don't start new projects on Vercel KV/Postgres (both discontinued); use Marketplace Redis/Postgres instead
- Store secrets in Vercel Env Variables; not in git or `NEXT_PUBLIC_*`
- Provision Marketplace native integrations with `vercel integration add` (CI/agent-friendly)
- Sync env + project settings with `vercel env pull` / `vercel pull` when you need local/offline parity
- Use `waitUntil` for post-response work; avoid the deprecated Function `context` parameter
- Set Function regions near your primary data source; avoid cross-region DB/service roundtrips
- Tune Fluid Compute knobs (e.g., `maxDuration`, memory/CPU) for long I/O-heavy calls (LLMs, APIs)
- Use Runtime Cache for fast **regional** caching + tag invalidation (don't treat it as global KV)
- Use Cron Jobs for schedules; cron runs in UTC and triggers your production URL via HTTP GET
- Use Vercel Blob for uploads/media; Use Edge Config for small, globally-read config
- If Enable Deployment Protection is enabled, use a bypass secret to directly access them
- Add OpenTelemetry via `@vercel/otel` on Node; don't expect OTEL support on the Edge runtime
- Enable Web Analytics + Speed Insights early
- Use AI Gateway for model routing, set AI_GATEWAY_API_KEY, using a model string (e.g. 'anthropic/claude-sonnet-4.6'), Gateway is already default in AI SDK
  needed. Always curl https://ai-gateway.vercel.sh/v1/models first; never trust model IDs from memory
- For durable agent loops or untrusted code: use Workflow (pause/resume/state) + Sandbox; use Vercel MCP for secure infra access
<!-- VERCEL BEST PRACTICES END -->

---

# EstateVault — Agent Roster

Each agent below has a scoped context brief. Load ONLY the relevant files listed.
Never load the full codebase unless explicitly needed.

---

## AGENT: Explorer (model: haiku)
**Use for:** Finding files, searching code, answering "where is X?" questions.
**Load:** Nothing. Use Glob/Grep only.
**Never:** Edit files. Just locate and report.

---

## AGENT: Frontend (model: sonnet)
**Use for:** UI components, pages, Tailwind styling, quiz flows, forms.
**Load these paths only:**
- `app/` (page files and layouts)
- `components/`
- `tailwind.config.ts`
- `app/globals.css`

**Brand tokens:** Navy `#1C3557` · Gold `#C9A84C` · White `#FFFFFF` · Charcoal `#2D2D2D` · Font: Inter
**Never:** Touch `lib/`, `app/api/`, or DB logic.

---

## AGENT: Backend (model: sonnet)
**Use for:** API routes, Supabase queries, Stripe, Resend email, server actions, auth middleware.
**Load these paths only:**
- `app/api/`
- `lib/`
- `middleware.ts`
- `supabase/`

**Key constraints:**
- Never give legal advice — generate documents from answers only
- Hard stops: special needs dependent, irrevocable trust → attorney referral (hardcoded, no override)
- Pricing is fixed (see CLAUDE.md)
**Never:** Touch `components/` or page UI.

---

## AGENT: Schema (model: haiku)
**Use for:** Zod schemas, TypeScript types, form validation.
**Load these paths only:**
- `lib/validation/`
- `lib/will-types.ts`
- `lib/trust-types.ts`
- `lib/quiz-types.ts`

**Never:** Edit pages, API routes, or UI components.

---

## AGENT: Review (model: opus)
**Use for:** Pre-deploy security review, logic audit, breaking change check.
**Load:** Full diff (`git diff main`) + any file flagged in the diff.
**Checklist:** Auth bypass · SQL injection · exposed secrets · pricing override · hard-stop bypass · Stripe webhook validation.
**Use sparingly** — only before merges to master.

---

## Workflow Pattern

```
Task: "Add new field to will form"

1. Explorer (haiku)  → find relevant files
2. Schema   (haiku)  → add Zod field + TS type
3. Backend  (sonnet) → update API route / server action
4. Frontend (sonnet) → update form UI
5. Review   (opus)   → only if touching auth/payments/hard-stops
```
