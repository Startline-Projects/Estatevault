# Trustee Unlock Flow — Security Hardening TODO

Audit date: 2026-05-13

Scope: `/app/trustee/*`, `/app/api/trustee/*`, `lib/security/trusteeToken.ts`, `lib/security/trusteeSession.ts`, `lib/crypto/*`.

## Verdict

Crypto core is solid (E2EE intact, MK in worker only, HMAC tokens, hashed OTP at rest, signed-URL ciphertext only). Operational hardening incomplete. **Not production-ready until P0 items below are fixed.**

---

## P0 — Must fix before production

### 1. OTP send rate limiting

**Issue:** `POST /api/trustee/unlock-otp` has no cooldown. Attacker with phished/leaked email link can spam OTP emails (DoS the trustee inbox, social-engineering surface).

**Fix:**
- Add `otp_last_sent_at timestamptz` column to `farewell_verification_requests`.
- In `/unlock-otp` route, reject with 429 if `now - otp_last_sent_at < 60s`.
- Add IP-based rate limit (e.g. 5 sends per hour per IP) using existing `apiRateLimit` Upstash limiter.
- Add per-`requestId` daily cap (max 20 sends/24h).

### 2. OTP brute-force across sends

**Issue:** Each `/unlock-otp` call resets `otp_email_attempts` to 0. An attacker can fail 5 attempts, request new OTP, fail 5 more — unlimited brute force at 5 codes per send.

**Fix:**
- Add `otp_lifetime_attempts int default 0` column.
- Increment on every failed verify (do not reset on new send).
- Hard-cap at 20 lifetime attempts per request. Beyond cap, require admin re-approval to issue a new token.

### 3. Token revocation / "kick all sessions"

**Issue:** 7-day token TTL. Phished email link grants persistent access until owner-vetoes or window expires. Owner has no UI to revoke a trustee mid-window.

**Fix:**
- Admin UI button "Revoke trustee access" on the verification request row.
  - Sets `trustee_access_token_hash = NULL`, `vault_unlock_approved = false`, `owner_vetoed_at = now()`.
  - Invalidates all active sessions for that `requestId`.
- Owner-facing button (in dashboard) to revoke without admin assistance.

### 4. Owner notification on trustee unlock

**Issue:** Post-approval, owner is not notified when a trustee actually unlocks the vault. Silent compromise possible if owner is alive but unaware.

**Fix:**
- After successful `/unlock-verify`, send owner an email: "Your vault was unlocked by [trustee email] at [time] from [IP/region]. If this wasn't expected, click here to revoke."
- Revocation link = signed token that triggers the revoke flow from #3.
- Optional: SMS/push if phone number on file.

---

## P1 — High priority

### 5. Append-only audit log

**Issue:** `trustee_access_audit` table allows UPDATE/DELETE. Admin SQL or compromised service-role key could rewrite trustee history.

**Fix:**
- Add RLS policy: `DENY UPDATE, DELETE FOR ALL`.
- Service role currently bypasses RLS — add a Postgres trigger that raises on UPDATE/DELETE attempts to guarantee immutability.

### 6. `TRUSTEE_RELEASE_KEY` rotation + per-client envelopes

**Issue:** Single env-var key encrypts all `vault_master_share_c_enc` rows. Key leak = decrypt every client's share C historically.

**Fix:**
- Move release key to a managed KMS (Supabase Vault, AWS KMS, or GCP KMS).
- Envelope-encrypt: derive a per-client DEK from KMS root, encrypt share C with the per-client DEK. Store DEK encrypted under KMS.
- Rotation: re-wrap DEKs without touching share C ciphertext.

### 7. Server-side route guard on `/trustee/vault`

**Issue:** Page renders unconditionally; only API calls check the session. Minor information disclosure (UI structure) before failure.

**Fix:**
- Add middleware redirect: if no valid `trustee_session` cookie, redirect to `/`.
- Or convert `/trustee/vault/page.tsx` to a server component that calls `requireTrusteeSession()` before render.

---

## P2 — Defense in depth

### 8. Multi-factor on trustee unlock

**Issue:** Email-only OTP. If trustee email is compromised, attacker has full access path.

**Fix:**
- Optional SMS OTP as second factor (require both code from email AND code from SMS).
- Or WebAuthn/passkey registration at trustee setup time, required at unlock.

### 9. Anomaly detection

**Issue:** No automated alerting for unusual access patterns.

**Fix:**
- Log + alert on: unlock from new country, unlock outside trustee's historical hours, multiple rapid OTP failures.
- Send admin Slack/email on anomalies.

### 10. Client-side memory hygiene

**Issue:** Decrypted PDFs/videos live in browser memory + Blob URLs until tab closes. Forensic recovery from swap/RAM possible.

**Fix (limited in browser):**
- Revoke Blob URLs immediately after `<video>` ends or download triggers.
- Zero out decrypted Uint8Arrays before discarding (already done for keys via `zero()` — extend to file plaintext where feasible).
- Document inherent browser-environment risk in user-facing security notes.

### 11. CSRF defense beyond `sameSite=strict`

**Issue:** All POSTs rely on sameSite=strict cookie. Some browser bugs or extensions can bypass.

**Fix:**
- Add CSRF token in a separate cookie + header, validated server-side. Belt-and-suspenders.

### 12. `requireTrusteeSession` audit

**Issue:** Implementation not reviewed in this audit.

**Fix:**
- Verify session cookie is HMAC-signed (or JWS) with separate `TRUSTEE_SESSION_SECRET ≥32 chars`.
- Verify expiry enforced (24h TTL).
- Verify rotation on each call.

### 13. Storage RLS verification

**Fix:**
- Confirm `documents` and `farewell-videos` buckets deny all anon + authenticated direct access (only service role can sign URLs).
- Add automated test that hits `/storage/v1/object/public/documents/...` and expects 401/403.

### 14. Trustee-side phishing protection

**Issue:** Email link is a long base64url string. Trustees may forward it without realizing it grants access.

**Fix:**
- Add visible warning in unlock email: "This link grants access to a private vault. Do not forward."
- Bind token to user-agent hash on first OTP send; reject on UA mismatch (with friendly "re-request link" path).

---

## Already correct (verified)

- HMAC bound to `(requestId, email, expiresAt)` with `TRUSTEE_TOKEN_SECRET ≥32` enforced.
- DB stores SHA256 of token, not raw token.
- Timing-safe MAC comparison (`timingSafeEqual`).
- OTP hashed at rest with secret pepper + per-request salt.
- Signed URLs 60s TTL, ciphertext only.
- Owner-veto re-checked on every read endpoint, cookie revoked on veto.
- Scope enforcement server-side (`access_scope` filter on items query).
- Audit log entries written for `otp_sent`, `otp_failed`, `unlocked`, `list_items`, `download_*`.
- Cookie: httpOnly + sameSite=strict + secure (prod).
- E2EE: MK reconstructed in Web Worker via Shamir, never leaves worker memory.
- Read-only trustee API (no mutating endpoints).
- Storage bucket policies deny anon (migration `20260509_e2ee_phase1.sql`).

---

## Implementation order (suggested)

1. **Week 1:** P0 #1, #2 (DB columns + cooldown logic + brute-force cap).
2. **Week 1:** P0 #4 (owner notification email).
3. **Week 2:** P0 #3 (admin + owner revocation UI).
4. **Week 2:** P1 #5 (audit log immutability).
5. **Week 3:** P1 #7 (route guard).
6. **Week 3–4:** P1 #6 (KMS migration for `TRUSTEE_RELEASE_KEY`).
7. **Backlog:** P2 items.

## Files affected (reference)

- `app/api/trustee/unlock-otp/route.ts` — #1, #2 rate limiting
- `app/api/trustee/unlock-verify/route.ts` — #2 lifetime attempts, #4 owner notification
- `app/api/admin/farewell-verification/route.ts` — #3 revoke endpoint
- `app/dashboard/vault/trustees/page.tsx` — #3 owner revoke UI
- `lib/security/trusteeToken.ts` — possibly UA binding for #14
- `lib/security/trusteeSession.ts` — #12 review
- `lib/crypto/trusteeRelease.ts` — #6 KMS integration
- `middleware.ts` — #7 route guard
- `supabase/migrations/<new>.sql` — DB columns for #1, #2; RLS for #5
