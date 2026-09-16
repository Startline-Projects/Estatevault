# Pour-Over Will staleness — proposal

Prompt 6 made Section 3.3 of the Pour-Over Will list the client's primary trust
beneficiaries by name and share. The two documents are now coupled: if the
beneficiaries or shares change after the Pour-Over Will was generated, the
stored Pour-Over Will contradicts the Trust.

**Schema changes are proposed here, not implemented.**

## What exists today

Investigated across `documents`, `orders`, `quiz_sessions`, the three generation
routes, the amendment flow and the Stripe webhook handlers.

| Question | Answer |
|---|---|
| Does any record store what intake a document was generated from? | **No.** No hash, no snapshot, no pointer, no `updated_at` on `documents`. |
| Is there a "needs regeneration" flag? | **No.** The only regeneration signal is file absence (`storage_path IS NULL`), used by `regenerate-missing`. |
| Is `documents.template_version` usable? | **No.** It is the string literal `"1.0"` at all three write sites and is never read, while the templates are `v1.1.0`. |
| Can intake even be edited after generation? | **No.** `quiz_sessions.answers` is insert-only — its only UPDATE is the E2EE purge to `{}`. `orders.intake_data` is written once at checkout. The amendment flow creates a **new** order and a **new** quiz session and regenerates nothing. |

**So the scenario cannot occur today.** There is no edit path. What Prompt 6
actually introduces is the *coupling*; the exposure arrives with whatever
feature first lets intake be edited — most likely a structured amendment flow.

## Proposal

### 1. Record what each document was built from

```sql
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS source_fingerprint text;

COMMENT ON COLUMN documents.source_fingerprint IS
  'HMAC of the intake fields this document''s content depends on. Compared against the current intake to detect a stale document. Null for documents generated before fingerprinting.';
```

One nullable column. No new table, no discriminator.

`lib/documents/staleness.ts` already provides the primitive:
`beneficiaryFingerprint()` returns a 32-char HMAC over the canonicalised
`full_name` + `share_percent` list.

**Why an HMAC and not a plain hash.** Plaintext quiz answers are purged after
generation (`quiz_sessions.answers_purged_at`). A plain digest of a short name
list can be confirmed by guessing, which would put back the data the purge
exists to remove. Keyed on `HANDOFF_SECRET`, the value is comparable but not
guessable.

**Why not store the beneficiary list itself.** Same reason. The fingerprint is
enough to answer "did this change?", which is the only question being asked.

### 2. Write it at generation, check it before delivery

- `uploadDocument()` in `lib/documents/storage.ts` already sets
  `storage_path`, `status` and `generated_at` for `(order_id, document_type)`.
  It takes one more field.
- Before delivering a Pour-Over Will, `checkPourOverStaleness(recorded, current)`
  decides. A stale document is marked `blocked` with `generation_error` set,
  which reuses the fulfillment gate built earlier — an order with any blocked
  document is not delivered and the admin alert fires once.
- A document with **no** recorded fingerprint is reported stale rather than
  assumed current, so pre-existing documents surface for a human instead of
  passing silently.

### 3. Regenerate rather than block, where it is safe

Regenerating a Pour-Over Will is cheap and deterministic — it needs no model
call. Where the current intake is still present, the better behaviour is to
regenerate and supersede: `documents` already has `superseded_at`,
`superseded_by`, `parent_document_id` and `version`, which is exactly the shape
for this and is currently unused.

Blocking is the fallback for when intake is gone (post-purge) and the document
therefore cannot be rebuilt.

## What was implemented now, without schema

- `lib/documents/staleness.ts` — the fingerprint, the canonical form, the
  staleness verdict, and `assertPourOverMatchesTrust()`, a generation-time guard
  that turns "both documents read the same intake" from an assumption into an
  assertion. 12 tests.
- A test asserting the rendered Trust and the rendered Pour-Over produce
  identical beneficiary lists from one intake.

## Two pre-existing defects found while investigating

Neither is caused by Prompt 6; both are worth their own fix.

1. **A Stripe webhook replay can silently destroy `orders.intake_data`.**
   The handler re-reads intake from `quiz_sessions` and writes it back to the
   order. After the E2EE purge that source is `{}`, so a replay overwrites a
   good snapshot with nothing.

2. **`documents.template_version` is a lie.** Hardcoded `"1.0"` at all three
   write sites, never read, while templates are `v1.1.0` and `v1.0.0`. Anything
   that later tries to reason about which template version produced a document
   will get the wrong answer.
