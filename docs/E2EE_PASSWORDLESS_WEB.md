# EstateVault — Passwordless E2EE Plan (Web)

**Repo:** `/Users/xamir/Desktop/Glo Staffing/Estatevault` (Next.js, canonical backend host)
**Companion plan:** `../estate_vault_app/docs/E2EE_PASSWORDLESS_MOBILE.md`
**Unchanged data-plane spec:** `docs/CRYPTO_SPEC.md`, `docs/crypto-vectors.json`

## 0. Goal

Remove the user passphrase. Users are mostly elderly — typing/remembering a strong passphrase is a blocker. Replace it with a **6-digit PIN** that unlocks the same vault on web and mobile, while keeping **zero-knowledge end-to-end encryption** (server never sees plaintext or the Master Key).

The vault is shared: the **Master Key (MK)** and the `EV01`/`EVS1` envelope format in `CRYPTO_SPEC.md` do **not** change. Only how MK is wrapped/unlocked changes. Because MK and the ciphertext format are identical across clients, a vault encrypted on web decrypts on mobile and vice versa with no data migration to the rows themselves.

> **Encryption model — DECIDED 2026-05-24 (REVISED): Option A — server-managed (recoverable) encryption**, chosen for user ease (easy email password reset, no data loss; matches Trust & Will / Everplans / Trustworthy). **Implementation spec = Appendix A** here + `docs/OPTION_A_IMPL.md`. Sections 1–10 (zero-knowledge / PIN+SVR) are now the **rejected alternative**, kept for reference. Tradeoff accepted: the server CAN decrypt → do **not** advertise "zero-knowledge" / "end-to-end" / "we can't see your data" (Appendix A.6).

## 1. What changes vs today

| Layer | Today | After this plan |
|---|---|---|
| MK root key | 32B random, per user | unchanged |
| Data encryption (rows, files) | `EV01`/`EVS1` envelopes, XChaCha20-Poly1305 | unchanged |
| MK wrapper (primary) | `wrapped_mk_pass` (Argon2id over passphrase) | **`wrapped_mk_svr`** (PIN via server SVR) |
| Recovery | `wrapped_mk_recovery` (mnemonic shown to user) | trustee/Shamir + silent mnemonic backstop |
| Daily unlock | type passphrase | type 6-digit PIN (web); biometric on mobile |
| New device | type passphrase | same PIN anywhere (SVR) |

The passphrase wrapper (`wrapped_mk_pass`) is **kept during migration** for existing users, then deprecated (§8).

## 2. Core idea — Secure Value Recovery (SVR)

A 6-digit PIN has only 1,000,000 combinations. If a PIN-derived key alone wrapped MK and that wrapper sat in Postgres, a database dump would be brute-forced offline quickly — breaking zero-knowledge. SVR fixes this by putting a **high-entropy server secret + a hardware-protected attempt counter** between the PIN and MK, so every guess must go through the server, which throttles and then destroys the secret.

This is the Signal SVR / Apple iCloud Keychain escrow model.

### 2.1 Key custody backend (the one hard dependency)

`svr_secret` must live where a Postgres dump cannot reach it and where the attempt counter cannot be reset by a DB writer. Options, **decision to confirm**:

| Backend | Strength | Effort | Notes |
|---|---|---|---|
| AWS KMS / CloudHSM | strongest | medium | `svr_secret` is a non-exportable KMS key; OPRF eval via KMS or via app with KMS-wrapped secret. Recommended default. |
| GCP KMS | strong | medium | Pick if already on Google Cloud. |
| Supabase Vault (+ pgsodium) | lighter | low | `svr_secret` encrypted at rest; counter in Postgres. Cheapest, weaker against a *full live-server* compromise. Acceptable MVP. |

This plan is written against an abstract **Key Custody Service (KCS)** with two operations: `oprf_eval(user_id, blinded_point)` and `rotate/destroy(user_id)`. Swap the concrete backend without touching client code.

### 2.2 OPRF

Use a verifiable Oblivious PRF over Ristretto255 (RFC 9497 VOPRF). The server applies `svr_secret` to the client's blinded PIN point without learning the PIN; the client cannot evaluate it offline without the server. Output → `KEK_pin`.

- Web lib: `@noble/curves` (ristretto255) — already in the `@noble` family used by the crypto module; add the VOPRF wrapper.
- Must produce byte-identical results to the mobile Dart implementation (add VOPRF vectors to `crypto-vectors.json`).

## 3. Architecture (web)

```
Browser (React)
 ├─ crypto worker (existing): MK + subkeys in worker scope only
 ├─ SVR client: blind PIN → /api/crypto/svr/* → KEK_pin → unwrap MK
 └─ optional: WebAuthn passkey (PRF) as faster re-unlock on trusted browser
        │ HTTPS, Supabase JWT (cookie)
        ▼
Next.js API (/app/api/*)
 ├─ crypto/svr/enroll, /unlock, /change-pin, /status   (NEW)
 ├─ crypto/bootstrap, /bundle (existing; drop passphrase fields over time)
 ├─ vault/items, /search, /upload-url, /download-url    (existing)
 └─ Key Custody Service adapter (KMS / Supabase Vault)
        ▼
Supabase (Postgres + Storage): ciphertext only + svr_records (no usable secret in a dump)
```

## 4. Flows

### 4.1 New signup (passwordless)
1. Standard Supabase signup.
2. Client generates `MK = random(32)`, keypairs (x25519, ed25519) per `CRYPTO_SPEC.md §5–7`.
3. `PinSetupScreen`: choose 6-digit PIN (block trivial PINs: `000000`, `123456`, repeats, sequences).
4. SVR enroll: `POST /api/crypto/svr/enroll` → server creates `svr_secret` in KCS, counter=0; client runs VOPRF to get `KEK_pin`; client computes `wrapped_mk_svr = wrap(MK, KEK_pin)` and uploads it.
5. Generate a **recovery mnemonic** but do **not** require the user to write it down. Store `wrapped_mk_recovery` and offer trustee/Shamir recovery setup (`crypto/shamir-setup`, already present) during onboarding or later.
6. `POST /api/crypto/bootstrap` with pubkeys + `wrapped_mk_svr` (+ `wrapped_mk_recovery`).

### 4.2 Login / unlock
1. Supabase signin.
2. `GET /api/crypto/bundle` → `{ has_svr, enc_version, kdf_params(if legacy) }`.
3. `PinUnlockScreen`: enter PIN → `POST /api/crypto/svr/unlock` (VOPRF) → server checks counter < limit, increments → client derives `KEK_pin` → unwrap MK → load into worker. On success, reset counter.
4. Wrong PIN increments counter; show remaining attempts; at limit server destroys `svr_secret` → PIN path dead → route user to recovery (§4.5).

### 4.3 Optional faster re-unlock (passkey)
After first PIN unlock on a browser, offer "Use this device to unlock" → register a WebAuthn passkey with the `PRF` extension; derive a wrapper for MK stored in `IndexedDB` (ciphertext only). Subsequent visits unlock with platform biometric / device PIN, no SVR round-trip. Falls back to PIN. Off by default; pure convenience.

### 4.4 Change PIN
`POST /api/crypto/svr/change-pin`: verify old PIN (SVR unlock), rotate `svr_secret`, re-derive `KEK_pin'`, re-wrap MK → new `wrapped_mk_svr`. Counter reset.

### 4.5 Recovery (PIN lost or SVR locked)
Primary: **trustee/Shamir** (reuse `crypto/shamir-setup`). Trustees approve → reconstruct MK → user sets a new PIN (re-enroll SVR). Secondary: mnemonic if the user kept it. After recovery, SVR is re-enrolled fresh.

## 5. API endpoints (web repo)

New:
- `POST /api/crypto/svr/enroll` — create `svr_secret`, store `wrapped_mk_svr`.
- `POST /api/crypto/svr/unlock` — VOPRF eval with counter enforcement.
- `POST /api/crypto/svr/change-pin` — rotate + re-wrap.
- `GET  /api/crypto/svr/status` — `{ attempts_left, locked, enrolled }`.

Changed:
- `crypto/bootstrap`, `crypto/bundle` — add `wrapped_mk_svr`; phase out passphrase-only fields.

**Auth fix (blocks mobile):** API routes currently authenticate via Supabase **cookies** (`supabase.auth.getUser()` in `lib/api/auth.ts`). Mobile sends `Authorization: Bearer <supabase access token>`. Update the server Supabase client / `requireAuth()` to **also accept the Bearer token** (read `Authorization` header, `supabase.auth.getUser(jwt)`), keeping cookie auth for the web app. Without this, mobile gets 401 on every call. This is a prerequisite for sync.

## 6. Database (Supabase)

New table:
```sql
CREATE TABLE svr_records (
  user_id        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  secret_ref     text NOT NULL,          -- KMS key id, or KMS-wrapped secret ciphertext
  attempt_count  smallint NOT NULL DEFAULT 0,
  max_attempts   smallint NOT NULL DEFAULT 10,
  locked_at      timestamptz,
  enc_version    smallint NOT NULL DEFAULT 1,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE svr_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY svr_no_direct ON svr_records FOR ALL USING (false) WITH CHECK (false);
```
- All access via API routes using the service-role client (same pattern as `item_shares`).
- `clients` adds `wrapped_mk_svr bytea`. Keep `wrapped_mk_pass` nullable through migration.
- Counter increments must be transactional and, for the strong backends, mirrored/enforced in the KCS so a DB writer cannot reset attempts.

## 7. Threat model change (state explicitly to stakeholders)

SVR preserves "Supabase admin / DB dump sees ciphertext only" **when the KCS is KMS/HSM-backed** — the dump lacks a usable `svr_secret`. It adds one new exposure vs the passphrase model: a **fully compromised live server** (Vault root key + DB + code simultaneously) could brute-force a 6-digit PIN. Mitigations:
- KMS access logging + anomaly alerts.
- Low lockout (10), exponential backoff.
- 6-digit PIN (chosen): 1M space vs 10k for 4-digit.
- Trustee recovery so lockout never means permanent loss.

Update `docs/CRYPTO_SPEC.md §16` threat table to reflect SVR once this ships.

## 8. Migration (existing passphrase users)

1. Ship SVR + dual support (passphrase OR PIN).
2. On next login, after passphrase unlock, prompt "Set a PIN" → enroll SVR, write `wrapped_mk_svr`.
3. After adoption window, hide passphrase entry; keep `wrapped_mk_pass` as a hidden fallback for one release, then drop the column.

## 9. Build phases

1. KCS adapter + `svr_records` migration + `clients.wrapped_mk_svr` (confirm backend §2.1).
2. VOPRF (TS) + add VOPRF/SVR vectors to `crypto-vectors.json`; **freeze the still-`<TBD>` vectors** (kdf, mnemonic, keypair, blind_index) so mobile parity is testable.
3. `crypto/svr/*` routes + counter enforcement + lockout.
4. **Bearer-token auth** on API routes (mobile prerequisite).
5. Web UI: PIN setup / unlock / change; remove passphrase from new-signup path.
6. Optional WebAuthn passkey re-unlock.
7. Migration prompt for existing users; deprecate passphrase.

## 10. Decisions (CONFIRMED 2026-05-24, REVISED → Option A)
- **Encryption model**: **Option A — server-managed (recoverable)** (Appendix A + `OPTION_A_IMPL.md`). Zero-knowledge (§1–9) NOT chosen.
- **Key backend**: **Supabase Vault** (pgsodium) holds the KEK wrapping per-user DEKs (MVP); revisit AWS/GCP KMS before scale.
- **PIN**: 6-digit, used only as an in-app convenience lock (NOT the encryption root); resettable.
- **Recovery**: forgot password = standard Supabase email reset, no data loss. Trustee/Deputy = heir access.
- **Marketing constraint**: cannot claim zero-knowledge / E2E (Appendix A.6).

---

# Appendix A — Option A: Server-managed (recoverable) encryption

**This is an ALTERNATIVE to §1–9, not an addition.** If chosen, the SVR / OPRF / zero-knowledge key-custody machinery is **not built** — the PIN becomes only a convenience lock, not the encryption root.

## A.1 What it is

Standard server-side encryption with hardware-protected keys, like the estate-vault market (Trust & Will, Everplans, Trustworthy). The server can decrypt user data, which is what makes "forgot PIN → email reset → data intact" possible.

- **Login:** Supabase email + password + MFA (existing). No passphrase.
- **Vault PIN:** optional in-app lock for convenience/biometric; **resettable via email** because the server holds the keys. The PIN does NOT protect against the server.
- **Encryption happens server-side** (in API routes) or client-side with a server-managed key — either way the key custody is server-side.

## A.2 Key architecture — envelope encryption + KMS/HSM (never plaintext keys)

```
Vault data (rows + files) ──AES-256-GCM──> encrypted with per-user DEK
DEK ──wrapped by──> KEK held in KMS/HSM (AWS KMS / GCP KMS / CloudHSM)
Postgres stores: ciphertext + WRAPPED DEK (both encrypted at rest)
KMS/HSM stores: KEK — non-exportable, never in DB or app
Runtime: API asks KMS to unwrap DEK (in memory only) → decrypt → discard
```

- **Per-user DEK** (one data key per user; optionally per-table sub-keys).
- DEK stored only in wrapped form in `clients.wrapped_dek`.
- KEK never leaves the HSM; every unwrap is IAM-scoped and **audit-logged**.
- **No plaintext keys at rest.** The tradeoff is the server's *capability* to unwrap, not the storage format.

## A.3 Data storage

Reuse the existing ciphertext columns from the E2EE migration (`vault_items.ciphertext/nonce`, etc.) — the format can stay; only **who holds the key** changes. The blind-index columns are unnecessary here (server can search plaintext in-memory or use normal indexes after decrypt), but keeping them is harmless.

## A.4 Flows

- **Signup:** Supabase signup → server generates per-user DEK, wraps with KMS KEK, stores `wrapped_dek`. Optional: user sets an app PIN + biometric for the in-app lock.
- **Login/unlock:** Supabase signin → API unwraps DEK via KMS for that request → serves decrypted data over TLS (or hands the unwrapped DEK to the authenticated client to decrypt locally).
- **Forgot PIN / password:** Supabase email reset → new password → **full access retained, zero data loss** (keys are server-side). This is the whole point of Option A.
- **Heir / executor access ("Deputy"):** server re-wraps the DEK for a verified recipient after a death/incapacity trigger — easy, because the server can access the key. No cryptographic sharing protocol needed.

## A.5 Security requirements (non-negotiable for Option A)

- KMS/HSM for the KEK — **never** an env-var secret co-located with the DB.
- Least-privilege IAM on KMS; separate decrypt role; alerting on bulk/anomalous decrypts.
- Per-field or per-user DEK; TLS everywhere; MFA; RLS; full audit logging of every decrypt.
- Optional **partial hybrid:** client-side pre-encrypt the most sensitive fields (e.g. account passwords) with a user-only key so even Option A can't read those, while documents stay recoverable.

## A.6 Claims you may / may not make

- ✅ May claim: "AES-256, bank-level encryption," "encrypted at rest & in transit," "per-user keys," "MFA," "SOC 2," "our staff don't access your data (audited)."
- ❌ May NOT claim: "zero-knowledge," "end-to-end encrypted," "only you can unlock," "even we can't see your data." (Server can decrypt → these would be false.)

## A.7 Impact vs §1–9 (what drops / simplifies)

- **Drops:** SVR, OPRF, `svr_records`, `wrapped_mk_svr`, recovery phrase as the *only* path, Shamir-for-unlock. PIN demoted to a UX lock.
- **Simplifies:** mobile (Appendix A of mobile plan) needs little/no client crypto; sync is trivial (server decrypts for both clients); heir access is a server operation.
- **Still needed:** Bearer-token auth on API routes if mobile decrypts client-side or calls the API (mobile prerequisite, unchanged).
