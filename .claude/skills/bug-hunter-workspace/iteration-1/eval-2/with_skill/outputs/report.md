# Bug Hunt — Vault (what could break it / leak data) — 2026-06-04

## Summary
5 findings (1 Critical, 2 High, 1 Medium, 1 Low) across the vault API surface:
client item CRUD, encrypted search/upload/download, the per-user file key, the
PIN gate, and the trustee read path. Core leak risks are an unconstrained
`storagePath` that the trustee download path will sign, and an unthrottled PIN
gate. Crypto envelope/roundtrip tests are green.

## Confirmed findings

### Critical — Owner-controlled `storage_path` injection -> cross-tenant file read via trustee
- **Area:** `lib/validation/schemas.ts:21-38` (`vaultItemSchema.storagePath: z.string().optional()`),
  `app/api/vault/items/route.ts:100` (stored verbatim),
  `app/api/trustee/vault/download-url/route.ts:48-53` (signs the stored path).
- **What:** On item create, `storagePath` is accepted as a free-form string with
  no constraint that it begin with `vault/<client.id>/`. The owner's own
  `download-url` route (`app/api/vault/download-url/route.ts:27-30`) rejects
  non-prefixed paths, but the **trustee** download-url route does not — for
  `type=vault_item` it looks up the row, checks only `client_id` and
  `categoryAllowed`, then calls `createSignedUrl(storage_path)` from the
  `documents` bucket on whatever path is stored. A user can therefore set their
  own item's `storage_path` to another tenant's object key
  (`vault/<other-client-id>/<file>.bin`); once their trustee gains approved
  access, the trustee route mints a signed URL for that other tenant's file.
- **Impact:** Cross-tenant data leak of stored documents/files. The vault's core
  promise (your data stays yours) breaks.
- **Repro:** As client A, POST `/api/vault/items` with
  `storagePath: "vault/<clientB-id>/<known-or-guessed-id>.bin"`. Have A's trustee
  reach approved access, then GET
  `/api/trustee/vault/download-url?type=vault_item&id=<A-item-id>` -> returns a
  signed URL to B's object.
- **Fix:** Validate `storagePath` at the boundary to start with the caller's
  `vault/<client.id>/` prefix (mirror the check already in
  `download-url/route.ts:27-30`), and re-assert the prefix in the trustee
  download-url route before signing.

### High — Vault PIN gate has no rate limiting or lockout (brute-force)
- **Area:** `app/api/vault/pin/route.ts:46-54` (`verify`) and `:56-65` (`change`).
- **What:** The `verify` and `change` actions `bcrypt.compare` a 6-digit PIN with
  no attempt counter, no lockout, and no rate limiter. Every other sensitive
  vault route (`download-url`, `file-key`, `upload-url`) calls
  `apiRateLimit.limit(...)`; the PIN route does not. 6 digits = 1M combos; an
  authenticated session can script attempts until it succeeds.
- **Impact:** The app-lock PIN guarding vault access is brute-forceable.
- **Repro:** With a valid session, POST `{action:"verify", pin:"000000"}` in a
  loop incrementing the PIN — no throttle or lockout triggers.
- **Fix:** Add `apiRateLimit.limit(\`vault-pin:${user.id}\`)` plus a per-account
  failed-attempt lockout to `verify`/`change`, matching `download-url`.

### High — `vaultDownloadUrlSchema.path` not checked for path traversal
- **Area:** `lib/validation/schemas.ts:87-90`, `app/api/vault/download-url/route.ts:27-30`.
- **What:** Path scoping uses `startsWith("vault/<client.id>/")` only; no `..`
  rejection. `vault/<self>/../<victim>/<file>.bin` passes `startsWith` while
  potentially resolving outside the prefix depending on Storage key
  normalization.
- **Impact:** Possible cross-tenant read. The input check is unsound as written.
- **Repro:** POST with `{ path: "vault/<self-id>/../<victim-id>/<file>.bin" }`.
- **Fix:** Reject any path containing `..` after the prefix check; apply to
  trustee download-url and upload-url too.

### Medium — Decrypt failures silently surfaced as items
- **Area:** `app/api/vault/items/route.ts:57-59`, trustee list `:115-117`.
- **What:** On `decryptBytes` throw, the row returns `label:"[decryption failed]"`,
  `data:{}` and HTTP 200, indistinguishable to ops from a normal item. Systemic
  key/ciphertext mismatch (silent data loss) is invisible.
- **Impact:** Vault-wide corruption produces 200s with garbage labels; no signal.
- **Fix:** Count decrypt failures and emit an audit/log event when any row fails.

### Low — Vault PIN allows trivial sequences
- **Area:** `lib/validation/schemas.ts:438-442`, `app/api/vault/pin/route.ts:38-44`.
- **What:** `/^\d{6}$/` accepts `000000`, `123456`, etc. With no lockout (High),
  weak PINs fall in a few tries.
- **Fix:** Reject obvious sequences/repeats on create/change.

## Needs verification
- Traversal (High) depends on Supabase Storage key normalization; confirm whether
  `..` resolves cross-prefix in the deployed Storage to rate Critical vs High.
- Trustee unlock/verify route (issuer of `ev_trustee_session`) not fully read;
  confirm it throttles attempts, since the session grants the owner's
  DEK-derived file key.

## Checked & OK
- `vault/items` POST/PATCH/DELETE: ownership re-checked via `getOwnerAndCiphertext`
  + `client_id`; order-linked items protected from deletion.
- `vault/items/search`: blind index from user's own INDEX key, scoped to client.id.
- `vault/upload-url`: server path `vault/<client.id>/<uuid>.bin`, size-limited,
  subscription-gated.
- `vault/file-key` + `trustee/vault/file-key`: rate-limited, keys zeroed, trustee
  gated on vault_unlock_approved + not vetoed (aside from storage_path Critical).
- `lib/security/trusteeSession.ts`: HMAC-SHA256 signed cookie, constant-time MAC,
  expiry, httpOnly/sameSite=strict/secure.
- Trustee list/download enforce verifyAccessStillValid + scope + audit.
- Crypto: vault-schemas + roundtrip tests pass (29/29).
