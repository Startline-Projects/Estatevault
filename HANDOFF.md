# template-revisions-v2 — handoff

Branch `template-revisions-v2`, pushed to
`github.com/Startline-Projects/Estatevault`. Based on `origin/staging`
(`8b62c58`). **Not merged. `PDF_RENDERER` not flipped.**

## Commits

| | Commit | What |
|---:|---|---|
| 1 | `313246c` | Prompt 1 — global formatting cleanup (legacy pdf-lib path) |
| 2 | `b2ecb06` | Prompt 1 — instruction sheet into the attorney-review DOCX |
| 3 | `6b9b02f` | (A) intake adapter fixes + strict per-document validation |
| 4 | `2f05400` | (C) one source of truth: `.ts` templates generated from `.txt` |
| 5 | `48054de` | (B) Prompt 1 ported to the v1.1.0 React-PDF pipeline |
| 6 | `afd1d7d` | Brand colour stripped from instrument pages |
| 7 | `f38231c` | Route-level fallback: blocked status, gate, admin alert |
| 8 | `f3c8de2` | Prompt 2 — Durable Power of Attorney |
| 9 | `87ddecd` | Prompt 3 — Patient Advocate Designation |
| 10 | `c258c9b` | Prompt 3B — POA/PAD answers collected in the will flow |
| 11 | `7caee7d` | Browser-walkthrough fixes (3 live defects) |
| 12 | `d21cd45` | Prompt 4 — Last Will and Testament |
| 13 | `af3db3e` | Prompt 5 — Trust + article auto-numbering engine |
| 14 | `d029927` | Prompt 6 — Pour-Over Will + `PENDING_ATTORNEY_REVIEW.md` |
| 15 | `48118ba` | Webhook clobber fix, real `template_version`, `source_fingerprint` |
| 16 | `c262cd8` | Prompt 7 — three Trust Package documents + joint trusts |
| 17 | `504e337` | Prompt 8 — per-beneficiary contingency |
| 18 | `a82ea4e` | Prompt 9 — attorney round 3: AHCD replaces the PAD, DPOA changes, citation sweep |
| 19 | `432c48a` | Prompt 9B — funeral preference, joint co-trustee UI, walkthrough fixes |
| 20 | — | Prompt 10B — the attorney's healthcare-wishes clause and How to Sign sheet |

## Templates

| Template | Status |
|---|---|
| `will-michigan-v1.1.0` | changed — Prompts 1, 4, 5, 8, 9, 9B, 10B |
| `trust-michigan-v1.1.0` | changed — Prompts 1, 5, 7, 8, 9, 9B |
| `pour-over-will-michigan-v1.1.0` | changed — Prompts 1, 6, 8, 10B |
| `dpoa-michigan-v1.1.0` | changed — Prompts 1, 2, 3, 9, 10B |
| `advance-healthcare-directive-michigan-v1.0.0` | **replaced the PAD** — Prompts 9, 10B |
| `certification-of-trust-michigan-v1.0.0` | **new** — Prompt 7 |
| `assignment-personal-property-michigan-v1.0.0` | **new** — Prompt 7 |
| `trust-funding-instructions-v1.0.0` | **new** — Prompt 7 |
| `hipaa-authorization-v1.1.0` | untouched |
| `funeral-rep-michigan-v1.0.0` | untouched |
| `guardian-nomination-michigan-v1.0.0` | untouched |

`.txt` is the source; `.ts` wrappers are generated. `npm run templates:check`
runs in `prebuild`.

## Tests

**972 total: 962 passing, 10 failing.**

All 10 failures are **pre-existing on `origin/staging`** — verified by running
the suite in a clean worktree of `8b62c58`, which produces the identical 10.
They live in `bug12-farewell-leak`, `checkout-schemas` (amendment schema),
`phase0-security`, `phase3-validation`, `phase6-frontend` and
`security-rule-guards`. One looks substantive: `custom_review_fee` clamping
expects `150000`, gets `30000`, tagged BUG-4 against the fixed-$300
attorney-review invariant.

Test count went from 528 to 972. Part of that is ~340 new tests; part is that
**vitest was never collecting `lib/documents/**`** — six files and ~1,500 lines
had never run. Added to the include globs, along with `lib/intake/**`.

Two harnesses beyond unit tests:
- `npm run docs:verify` — legacy pdf-lib path, 55 checks
- `Testing Scripts/verify-template-pipeline.ts` — v1.1.0 path, 50 checks,
  reading text and coordinates back out of the produced PDF bytes

## Blocking on attorney approval

`PENDING_ATTORNEY_REVIEW.md` — **one entry**: Step 5 of the Will's "How to Sign
This Will" sheet.

The attorney reviewed the rest across three rounds: 47 entries approved
2026-09-02, 24 approved 2026-09-13, 2 withdrawn. Two pieces of his own text were
supplied and integrated verbatim in Prompt 10B — the healthcare-wishes lead-in
in the Advance Healthcare Directive, and six of the seven signing steps.

Step 5 is held because his version told clients to ask the notary to prepare a
self-proving affidavit and the Will already contains one. A corrected step ships
in its place, marked in a template comment the renderer strips. If he confirms
his original wording it goes in verbatim.

Also outstanding from the compliance checklist: Drake (UPL review of the
rewritten Funding Instructions and the new questionnaire language), Mike (legal
sign-off on the Certification of Trust and Assignment templates).

## Before deploy

1. **Apply the migration** —
   `supabase/migrations/migration-document-generation-blocked.sql` adds
   `generation_error`, `source_fingerprint`, an `(order_id, status)` index and
   widens the status CHECK. Then re-run `npm run db:types`; the two columns were
   hand-added to `types/db.generated.ts`.
2. **`PDF_RENDERER` is unset** and must stay unset until compliance sign-off.
   Values are documented in `.env.local.example`.
3. **The Core Rule 4 hard stop was bypassable** on any post-purge webhook replay
   (`??` did not fall through on `{}`). Fixed here — worth flagging to whoever
   owns compliance, since it was live.

## Known gaps

- The legacy Claude path still exists and is the default. Prompts 2–8 targeted
  v1.1.0 only, so the two paths now differ.
- `documents.superseded_at` / `superseded_by` / `parent_document_id` / `version`
  exist in the live DB but their DDL is not in version control.
- The trustee question (`primaryTrustee` / `trusteeName`) is vestigial since the
  Grantor is always initial trustee. Left as-is pending an attorney decision.
- The Pour-Over Will still carries the development team's seven signing steps
  (its Section E). The attorney's replacement was supplied for the Will only, so
  the two documents now describe the same signing act in different words. No
  single package contains both — a Trust Package has the Pour-Over Will and a
  Will Package has the Will — so no client sees the two side by side, but the
  attorney's corrections reached only one of them.
- The client's free-text healthcare wishes render only in the v1.1.0 Advance
  Healthcare Directive. The legacy Claude path includes them too, but by
  instruction to the model rather than verbatim.
