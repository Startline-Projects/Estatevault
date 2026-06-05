# Vault Security Review — What Could Break It or Leak Data

Scope: the EstateVault encrypted vault — owner API routes (`app/api/vault/*`), trustee
access (`app/api/trustee/vault/*`, `app/api/farewell/*`), PIN, encryption, and storage
signing. Read-only review. Findings ordered by severity.

## Summary
Server-managed encryption ("Option A"): the server holds each user's DEK and encrypts at
rest. Most ownership checks are correct (items, trustee CRUD, the trustee unlock OTP flow is
genuinely well hardened). The real exposure is in storage-path and token-lifecycle gaps
where the server trusts a value it should re-derive or expire.

## HIGH — Cross-tenant file leak via unscoped farewell `storage_path`
- Where: `app/api/vault/farewell/upload-complete/route.ts` (writes body `storagePath`) +
  `app/api/vault/farewell/[id]/signed-url/route.ts` (signs it). Schema
  `farewellUploadCompleteSchema` (`lib/validation/schemas.ts:431`) =
  `storagePath: z.string().min(1)` — no prefix scoping.
- Problem: upload-complete only verifies the farewell message belongs to the caller, then
  writes whatever `storage_path` the client sends. Owner can set it to
  `vault/<other-client-id>/<uploadId>.bin`; signed-url (owner always allowed to view own
  message) mints a 7-day signed URL for that path.
- Impact: any authenticated vault user can read another tenant's encrypted farewell object
  from the shared `farewell-videos` bucket.
- Contrast: `app/api/vault/download-url/route.ts:27-30` correctly enforces
  `vault/${client.id}/`. upload-complete and signed-url do not.
- Fix: reject any storagePath not starting with `vault/${client.id}/` in both routes.

## HIGH — Trustee invite token never expires (contradicts the email)
- Where: `app/api/vault/trustees/route.ts` PATCH → `trusteeRepo.findByInviteToken` +
  `markActive` (`lib/repos/server/trusteeRepo.ts:43-57`).
- Problem: email says "expires in 7 days" but confirm only looks up by `invite_token` and
  flips status to active — no expiry check, token never burned.
- Impact: a leaked/forwarded invite link can activate a trustee at any future time; an
  active trustee is who can later request emergency vault access.
- Fix: enforce `invite_sent_at + 7d` window; null `invite_token` after confirm.

## MEDIUM — Vault PIN verify/change has no rate limiting
- Where: `app/api/vault/pin/route.ts` (verify, change). No limiter imported; 6-digit PIN
  (10^6), single bcrypt.compare, no lockout → brute-forceable.
- Mitigating: PIN is a UX app-lock, not the encryption key, but it gates the vault UI.
- Fix: per-user sliding-window limit + failure lockout.

## MEDIUM — Over-long signed-URL TTLs on private media
- Where: `farewell/[id]/signed-url/route.ts:44` = 7 days (604800s);
  `download-document/route.ts:39` = 1 hour. Owner download-url uses 300s, trustee uses 60s.
- Problem: signed URLs are bearer credentials; these TTLs are wildly inconsistent and
  amplify the farewell-path leak above.
- Fix: drop to minutes.

## LOW — `ilike` on attacker-supplied trustee email
- Where: `app/api/farewell/access/route.ts:71` `.ilike("trustee_email", trusteeEmail)`.
- Problem: `%`/`_` treated as wildcards; `%@%` can match an unintended trustee request for
  that client (this query drives which request gets a sign-in email).
- Fix: exact `.eq` or escape wildcards.

## Correct (don't regress)
- `download-url` enforces the `vault/<client.id>/` prefix + re-checks farewell ownership.
- Trustee unlock OTP (`unlock-verify`) is solid: hashed token + token-hash match + access
  expiry + hashed OTP + atomic 10-attempt cap + OTP burn.
- Trustee list/download re-check `vault_unlock_approved`/`owner_vetoed_at` and enforce
  `access_scope` before signing.
- Vault item GET/PATCH/DELETE scope by `client.id`; key zeroing is consistent.
