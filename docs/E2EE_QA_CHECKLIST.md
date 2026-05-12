# E2EE QA Checklist

Pre-release acceptance for the E2EE rollout. Run on staging first, then prod canary, then full prod. Sign off each section.

## 0. Prerequisites
- [ ] All Phase 1–14 migrations applied to target DB.
- [ ] `CSP_ENFORCE` unset (Report-Only) for first 7 days.
- [ ] Mobile app deployed with same `enc_version=1` support.
- [ ] `crypto-vectors.json` frozen (status field reads "Frozen").

## 1. Vector parity
- [ ] `npx tsx scripts/generate-crypto-vectors.ts --check` exits 0.
- [ ] `npx vitest run lib/crypto/__tests__` 100 % pass.
- [ ] Mobile CI: `dart test --tags vectors` 100 % pass.

## 2. Onboarding
- [ ] New signup → `/onboarding/vault-setup` reachable.
- [ ] Passphrase form rejects <12 chars + zxcvbn score < 3.
- [ ] Mnemonic display shows exactly 24 words from BIP39 wordlist.
- [ ] Mnemonic confirm requires 3 random words; wrong words rejected.
- [ ] After bootstrap, `clients.crypto_setup_at` populated; `wrapped_mk_pass`/`wrapped_mk_recovery`/pubkeys non-null.
- [ ] DB inspection: no plaintext passphrase or mnemonic anywhere.
- [ ] Refresh during step 2/3 = restart accepted (no DB row).

## 3. Lock + unlock
- [ ] After login + bootstrap, idle 15 min → vault locks (worker zeros MK).
- [ ] Hidden tab > 5 min → vault locks.
- [ ] Re-enter passphrase → unlock.
- [ ] 11 wrong attempts in 1 minute → 429 from `/api/crypto/bundle`; UI shows rate-limit message.
- [ ] Tab close + reopen → relock; passphrase required.

## 4. Recovery
- [ ] `/recover` accepts 24 words + new passphrase.
- [ ] After rotate, login with new passphrase works.
- [ ] Old passphrase rejected.
- [ ] Existing items still decrypt (MK unchanged).

## 5. Vault items
- [ ] Create item via repo → DB row has `ciphertext`, `nonce`, `enc_version=1`, `label_blind` set; `label`/`data` NULL.
- [ ] Listing decrypts in browser; server logs show no plaintext.
- [ ] Search by label finds item via blind index.
- [ ] Delete item removes row.
- [ ] Cross-platform: web encrypts → mobile decrypts and vice versa.

## 6. Documents (signed URL upload)
- [ ] `POST /api/vault/upload-url` returns signed PUT (5-min TTL).
- [ ] Direct anon access to `documents` bucket → 403.
- [ ] Direct authenticated access (no signed URL) → 403 (per RLS).
- [ ] Upload encrypts; storage object is opaque bytes (not PDF magic).
- [ ] Download via repo decrypts to original PDF.
- [ ] Path-scoping: client A cannot request signed URL for client B's path → 403.

## 7. Farewell videos
- [ ] Upload streams (256 KiB chunks) without OOM for 100 MB file.
- [ ] DB row has `ciphertext` (metadata), `storage_header` 24B, `recipient_blind`.
- [ ] Server-sent invite email skipped on E2EE path; logged as `farewell.created` with `{encrypted:true}`.
- [ ] Download streams + decrypts.

## 8. Trustees
- [ ] Add trustee → DB has ciphertext + `email_blind`; `trustee_email`/`trustee_name` blank.
- [ ] Resend invite email still sent (transient `invite_email`).
- [ ] Audit log entry `{encrypted:true}` for E2EE add.
- [ ] List decrypts in browser.
- [ ] 3rd add rejected (max 2).

## 9. Sharing
- [ ] Owner shares item to recipient (E2EE-bootstrapped) → `item_shares` row inserted.
- [ ] Recipient `/api/share?direction=in` returns row.
- [ ] Recipient `decryptSharedItem(sealed, env)` produces plaintext.
- [ ] Owner revoke → `revoked_at` set; recipient list no longer returns row.
- [ ] Direct query `select * from item_shares` as authenticated user → 0 rows (RLS deny-all).

## 10. Server-generated PDFs (will/trust)
- [ ] Order generation → PDF sealed for client; `documents.sealed=true`.
- [ ] Client download via `documentSealedRepo.downloadGeneratedDocument` opens correctly.
- [ ] Storage object is `crypto_box_seal` output (not raw PDF magic).
- [ ] Attorney review attached → second sealed copy at `.attorney.bin`.
- [ ] Plaintext PDF NOT present in server logs/audit metadata.

## 11. Backfill
- [ ] User with legacy plaintext rows logs in → banner appears with count.
- [ ] After unlock + completion, banner disappears; `clients.crypto_backfill_complete_at` set.
- [ ] Counts query returns 0 across all 3 tables.
- [ ] Multi-tab safe: opening 2 tabs doesn't double-encrypt.
- [ ] Abort mid-backfill → resumable from where stopped.

## 12. CSP / headers
- [ ] `curl -I https://app.estatevault.com/dashboard` shows Strict-CSP, HSTS, X-Frame-Options DENY, etc.
- [ ] `Content-Security-Policy-Report-Only` present (until enforcement flip).
- [ ] `/api/csp-report` receives violations; logs in stderr.
- [ ] After 7 days zero violations → set `CSP_ENFORCE=1`, redeploy, re-verify.

## 13. Lint guards
- [ ] `npx next lint` shows zero errors (warnings on legacy fetch sites OK pre-refactor).
- [ ] After dashboard refactor, flip lint level to `error`.

## 14. DB sanity (run as service-role)
```sql
-- Plaintext columns drained to zero AFTER backfill:
SELECT count(*) FROM vault_items       WHERE ciphertext IS NULL AND label IS NOT NULL;
SELECT count(*) FROM vault_trustees    WHERE ciphertext IS NULL AND trustee_email <> '';
SELECT count(*) FROM farewell_messages WHERE ciphertext IS NULL AND title <> '';

-- All bootstrapped clients backfilled:
SELECT count(*) FROM clients
WHERE crypto_setup_at IS NOT NULL AND crypto_backfill_complete_at IS NULL;

-- No plaintext PII in audit metadata for E2EE rows:
SELECT count(*) FROM audit_log
WHERE action LIKE 'farewell.%'
  AND metadata::text ~* '@';   -- emails leaked into audit
```
All queries should return 0.

## 15. Penetration smoke
- [ ] Service-role query `select * from vault_items limit 5` returns ciphertext only (no PII via SQL inspection).
- [ ] Storage admin browse `documents/<client>/<order>/will.pdf` downloads → opens as binary, not PDF.
- [ ] Forced 401 on `/api/crypto/bundle` without auth.
- [ ] Forced 403 on cross-client `/api/vault/download-url` path.

## 16. Rollback plan
- [ ] `20260509_e2ee_phase1_rollback.sql` tested on staging snapshot.
- [ ] Browser flag to disable E2EE flow if onboarding breaks (`NEXT_PUBLIC_E2EE_DISABLED=1`) — TODO.
- [ ] Communications draft for users in case mass passphrase failure.

## 17. Compliance
- [ ] Privacy policy updated: data-loss risk on lost passphrase + mnemonic.
- [ ] DPA updated: server cannot read encrypted vault content.
- [ ] HIPAA scope confirmed; SOC 2 evidence of encryption-at-rest at the application layer.
- [ ] External audit booked (Trail of Bits / Cure53 / NCC) for post-GA.

---

Sign-off:
- Engineering: _________________
- Security:    _________________
- Legal:       _________________
- Date:        _________________
