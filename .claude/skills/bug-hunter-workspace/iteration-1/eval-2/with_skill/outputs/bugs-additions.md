# Proposed BUGS.md additions (vault) — NOT applied to repo BUGS.md
# Continue numbering after BUG-7.

## BUG-8 — Owner-controlled `storage_path` lets a trustee read another tenant's files
- **Severity:** Critical
- **Area:** `lib/validation/schemas.ts:21-38` (`vaultItemSchema.storagePath`), `app/api/vault/items/route.ts:100`, `app/api/trustee/vault/download-url/route.ts:48-53`
- **What:** `storagePath` on item create is an unconstrained string; it is stored verbatim. The owner's own download-url enforces a `vault/<client.id>/` prefix, but the trustee download-url route signs the stored `storage_path` after checking only `client_id` + category. An owner can point their item at another tenant's object key; their approved trustee then mints a signed URL to that file.
- **Impact:** Cross-tenant leak of stored vault files. Breaks vault data isolation.
- **Repro:** POST `/api/vault/items` with `storagePath: "vault/<otherClientId>/<file>.bin"`; once the owner's trustee has approved access, GET `/api/trustee/vault/download-url?type=vault_item&id=<item>` returns a signed URL to the other tenant's object.
- **Fix:** Constrain `storagePath` to the caller's `vault/<client.id>/` prefix at the Zod boundary, and re-assert the prefix in the trustee download-url route before signing.

---

## BUG-9 — Vault PIN gate has no rate limiting / lockout (brute-force)
- **Severity:** High
- **Area:** `app/api/vault/pin/route.ts:46-65` (`verify`, `change`)
- **What:** PIN verify/change `bcrypt.compare` a 6-digit PIN with no attempt counter, lockout, or rate limiter, unlike the other vault routes which call `apiRateLimit.limit`. 6 digits = 1M combinations.
- **Impact:** The app-lock PIN is brute-forceable from an authenticated session.
- **Repro:** POST `{action:"verify", pin:"000000"}` in a loop incrementing the PIN; no throttle/lockout ever fires.
- **Fix:** Add `apiRateLimit.limit(\`vault-pin:${user.id}\`)` plus a per-account failed-attempt lockout to `verify`/`change`.

---

## BUG-10 — Vault download-url path scoping does not reject `..` traversal
- **Severity:** High
- **Area:** `lib/validation/schemas.ts:87-90`, `app/api/vault/download-url/route.ts:27-30`
- **What:** Path scoping uses `startsWith("vault/<client.id>/")` with no `..` rejection. `vault/<self>/../<victim>/<file>.bin` passes the prefix check while potentially resolving outside the prefix depending on Storage key normalization.
- **Impact:** Possible cross-tenant read; the input check is unsound regardless.
- **Repro:** POST `{ path: "vault/<self-id>/../<victim-id>/<file>.bin" }` and check whether a signed URL to the victim object returns.
- **Fix:** Reject any path containing `..` after the prefix check; apply the same guard to trustee download-url and upload-url. (Confirm Storage normalization to finalize severity.)

---

## BUG-11 — Decrypt failures returned as 200 items, masking data-integrity loss
- **Severity:** Medium
- **Area:** `app/api/vault/items/route.ts:57-59`, `app/api/trustee/vault/items/route.ts:115-117`
- **What:** When `decryptBytes` throws, the row is returned with `label:"[decryption failed]"`, `data:{}`, HTTP 200 — indistinguishable from a normal item and emitting no alert. A systemic DEK/ciphertext mismatch (silent data loss) is invisible to ops.
- **Impact:** Vault-wide corruption surfaces as 200s with garbage labels; no operational signal.
- **Fix:** Count decrypt failures per request and emit an audit/log event (and a flagged field) when any row fails to decrypt.
