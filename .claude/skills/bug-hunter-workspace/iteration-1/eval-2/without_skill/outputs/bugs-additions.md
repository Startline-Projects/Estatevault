# Proposed BUGS.md entries (vault security review)

> Draft entries only — not applied to the repo's real BUGS.md.

## [HIGH] Cross-tenant farewell file leak via unscoped storage_path
- **Area:** Vault / farewell storage
- **Files:** `app/api/vault/farewell/upload-complete/route.ts`,
  `app/api/vault/farewell/[id]/signed-url/route.ts`,
  `lib/validation/schemas.ts:431` (`farewellUploadCompleteSchema.storagePath`)
- **Symptom:** `upload-complete` writes the client-supplied `storagePath` to the owner's
  farewell row with no prefix check. Owner can point it at
  `vault/<other-client-id>/...` and then mint a 7-day signed URL via `signed-url`, reading
  another tenant's private object from the `farewell-videos` bucket.
- **Expected:** `storagePath` must start with `vault/${client.id}/`; enforce in
  upload-complete and re-check in signed-url before signing (mirror
  `app/api/vault/download-url/route.ts:27-30`).
- **Status:** Unconfirmed at runtime; confirmed by code path.

## [HIGH] Trustee invite token never expires / not burned on use
- **Area:** Vault / trustees
- **Files:** `app/api/vault/trustees/route.ts` (PATCH),
  `lib/repos/server/trusteeRepo.ts:43-57`
- **Symptom:** Confirm path looks up by `invite_token` and sets status `active` with no
  expiry check, despite the email promising a 7-day expiry. Token is reusable indefinitely.
- **Expected:** Reject confirmations past `invite_sent_at + 7d`; null `invite_token` after
  confirm.
- **Status:** Confirmed by code path.

## [MEDIUM] Vault PIN verify/change has no rate limiting
- **Area:** Vault / PIN app-lock
- **Files:** `app/api/vault/pin/route.ts`
- **Symptom:** 6-digit PIN, single bcrypt compare, no limiter and no lockout → brute-forceable.
- **Expected:** Per-user sliding-window limit on `verify`/`change` + failure lockout.
- **Status:** Confirmed by code path.

## [MEDIUM] Over-long signed-URL TTLs on private vault media
- **Area:** Vault / storage signing
- **Files:** `app/api/vault/farewell/[id]/signed-url/route.ts:44` (7 days),
  `app/api/vault/download-document/route.ts:39` (1 hour)
- **Symptom:** Signed URLs are bearer credentials; 7-day/1-hour TTLs vastly exceed the
  5-min (owner) / 60s (trustee) norm used elsewhere.
- **Expected:** Reduce to minutes, consistent with `download-url` (300s) and trustee (60s).
- **Status:** Confirmed by code path.

## [LOW] `ilike` on attacker-supplied trustee email in farewell access
- **Area:** Vault / farewell access
- **Files:** `app/api/farewell/access/route.ts:71`
- **Symptom:** `.ilike("trustee_email", trusteeEmail)` treats `%`/`_` as wildcards; input
  like `%@%` can match an unintended trustee's verification request for that client.
- **Expected:** Exact match (`.eq`) or escape wildcards.
- **Status:** Confirmed by code path.
