# SVR Passwordless — Web Implementation Plan (grounded in current code)

> **⚠️ SUPERSEDED 2026-05-24.** The project switched to **Option A (server-managed, recoverable)** for user ease. This SVR/zero-knowledge plan is **on hold / not being implemented**. Active spec: `docs/OPTION_A_IMPL.md`. Kept for reference in case the decision reverts.

Concrete, file-level plan to implement the zero-knowledge passwordless model from `E2EE_PASSWORDLESS_WEB.md` §1–9, on top of the **existing** crypto stack. Read with that doc.

## 0. What already exists (reuse — do NOT rebuild)

Verified in the repo:

| Asset | File | Reuse for SVR |
|---|---|---|
| MK + envelope + subkeys + AEAD + stream | `lib/crypto/{keyManager,envelope,aead,streamAead,kdf}.ts`, `index.ts` | unchanged |
| libsodium (sumo) loader | `lib/crypto/sodium.ts` | OPRF built on this (has ristretto255) |
| Worker holds MK; `wrapKey`/`unwrapKey`; `unlockWithRawMk` | `lib/crypto/worker/api.ts` | **key hook**: SVR → MK → reuse `unlockWithRawMk` path |
| Bootstrap producing `wrappedMkPass`+`wrappedMkRecovery`+mnemonic | `worker/api.ts` `bootstrap()` | extend to also emit `wrappedMkSvr` |
| Mnemonic recovery | `worker/api.ts` `unlockWithMnemonic()` | Recovery Kit backstop (done) |
| **Trustee/Shamir recovery — FULLY BUILT** | `worker/api.ts` `setupTrusteeShamir()`/`unlockWithShamir()`, `app/api/crypto/shamir-setup` | the lockout backstop (done) |
| Client repo pattern | `lib/repos/cryptoRepo.ts` | mirror for SVR calls |
| Route/auth/audit/ratelimit pattern | `app/api/crypto/bootstrap/route.ts`, `lib/api/crypto.ts` (`requireClientUser`, `checkRate`, `logAudit`, `bytesToBytea`) | mirror for SVR routes |
| `clients` crypto columns + `crypto_setup_at` | migration `20260509_e2ee_phase1.sql` | add one column |

**Conclusion:** the data-plane and recovery are done. SVR = add a new MK wrapper (`wrapped_mk_svr`) + an OPRF unlock path. Passphrase code stays for migration.

## 1. Crypto choice — OPRF on libsodium ristretto255 (parity-safe)

`libsodium-wrappers-sumo` (already a dep) exposes ristretto255 (`crypto_core_ristretto255_from_hash`, `crypto_scalarmult_ristretto255`, `crypto_core_ristretto255_scalar_{random,invert,mul}`). Mobile's `sodium_libs` exposes the same. Build the OPRF on libsodium in **both** clients → byte-identical without depending on `@noble/curves` (not installed).

OPRF (RFC 9497, OPRF mode, ristretto255-SHA512), v1 = plain OPRF (server semi-trusted); add VOPRF DLEQ proof in v1.1.

```
KEK_pin derivation:
  client:  P = ristretto255_from_hash( SHA512("ev:svr:v1" || pin) )
           r = scalar_random();  blinded = scalarmult(r, P)            → send blinded
  server:  eval = scalarmult(svr_secret, blinded)                      → return eval
  client:  unblinded = scalarmult(r^-1, eval)         (= scalarmult(svr_secret, P))
           KEK_pin   = HKDF-SHA256(ikm=unblinded, info="ev:svr:kek:v1", L=32)
  wrapped_mk_svr = wrapKey(MK, KEK_pin)        // reuse existing wrapKey (EV01 envelope)
```

The PIN and `KEK_pin` never leave the worker; only `blinded`/`eval` (group elements) cross the network. `svr_secret` never leaves the server/KMS.

## 2. Server — new files & changes

### 2a. Migration `supabase/migrations/2026XXXX_svr.sql`
```sql
ALTER TABLE clients ADD COLUMN IF NOT EXISTS wrapped_mk_svr bytea;

CREATE TABLE IF NOT EXISTS svr_records (
  user_id        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  secret_ref     text NOT NULL,           -- KMS key id, or KMS-wrapped secret ciphertext
  attempt_count  smallint NOT NULL DEFAULT 0,
  max_attempts   smallint NOT NULL DEFAULT 10,
  locked_at      timestamptz,
  enc_version    smallint NOT NULL DEFAULT 1,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE svr_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS svr_no_direct ON svr_records;
CREATE POLICY svr_no_direct ON svr_records FOR ALL USING (false) WITH CHECK (false);
```

### 2b. KCS adapter `lib/api/kcs.ts`
Abstract over the backend (decision: AWS KMS / GCP KMS / Supabase Vault):
```ts
export interface Kcs {
  createSecret(userId: string): Promise<{ secretRef: string }>;     // new ristretto255 scalar in KMS
  oprfEval(secretRef: string, blinded: Uint8Array): Promise<Uint8Array>; // scalarmult(secret, blinded)
  destroy(secretRef: string): Promise<void>;                         // on lockout
  rotate(userId: string): Promise<{ secretRef: string }>;            // change-pin
}
```
- AWS/GCP: secret is a non-exportable key; eval done where the scalar lives (or via KMS-wrapped secret unwrapped in-process). Counter destruction = schedule key deletion so a DB-counter reset can't revive it.
- **Supabase Vault (CHOSEN, MVP):** store `svr_secret` (ristretto255 scalar, 32B) as a Vault secret via pgsodium; the route reads it through the service-role client, runs `scalarmult_ristretto255(secret, blinded)` in the Node route; counter in `svr_records`. On lockout, delete the Vault secret (irreversible). Weaker than KMS only against a full project compromise; fine for MVP.

### 2c. Routes (mirror `bootstrap/route.ts` style: `requireClientUser`, zod schema, `checkRate`, `logAudit`, `bytesToBytea`)
- `app/api/crypto/svr/enroll/route.ts` (POST): two-call or single —
  - `enroll-begin`: create `svr_records` (counter 0) via `kcs.createSecret`; return nothing secret. (Client then runs OPRF.)
  - `enroll-finish`: accept `wrappedMkSvr` (validate envelope, ≤256B) → `clients.wrapped_mk_svr`.
  - The OPRF eval needed to *compute* `KEK_pin` is served by the unlock route (`mode:"enroll"`) or a dedicated `svr/eval`. Simplest: one `svr/eval` route used by both enroll and unlock.
- `app/api/crypto/svr/eval/route.ts` (POST): body `{ blinded }`. Load `svr_records`; if `locked_at` or `attempt_count >= max_attempts` → 423 Locked + `kcs.destroy`. Else increment, `kcs.oprfEval`, return `{ eval }`. On a subsequent successful unwrap the client calls `svr/unlock-ok` to reset the counter (or reset on next bundle fetch after a verified action). Rate-limit per user + per IP.
- `app/api/crypto/svr/reset-counter/route.ts` (POST): called by client after a successful unwrap (proves PIN correct) → set `attempt_count=0`. (Counter only meaningfully resets on cryptographic success.)
- `app/api/crypto/svr/change-pin/route.ts` (POST): requires unlocked client; `kcs.rotate` + accept new `wrappedMkSvr`.
- `app/api/crypto/svr/status/route.ts` (GET): `{ enrolled, attemptsLeft, locked }`.

### 2d. Extend existing routes
- `bootstrap/route.ts`: accept optional `wrappedMkSvr` and write it (keep passphrase fields for migration).
- `bundle/route.ts`: add `hasSvr`, `wrappedMkSvr` (b64) to the response so unlock can fetch it.

### 2e. Auth (mobile prerequisite) `lib/api/crypto.ts` `requireClientUser` / `lib/api/auth.ts`
Currently cookie-only (`createClient().auth.getUser()`). Add: if `Authorization: Bearer <jwt>` present, validate via `admin.auth.getUser(jwt)`; else fall back to cookie. Keeps web working, unblocks mobile.

## 3. Client / worker — new files & changes

### 3a. `lib/crypto/oprf.ts` (new) — pure, libsodium-based
```ts
export async function oprfBlind(pin: string): Promise<{ blinded: Uint8Array; blindInv: Uint8Array }>;
export async function oprfUnblind(evalResp: Uint8Array, blindInv: Uint8Array): Promise<Uint8Array>; // → unblinded
export async function kekFromOprf(unblinded: Uint8Array): Promise<Uint8Array>;                        // HKDF → KEK_pin
```
Add `crypto-vectors.json` cases for blind(determinstic with fixed r)/eval/unblind/kek so mobile matches.

### 3b. `worker/api.ts` + `worker/types.ts` — new methods (keep PIN/KEK_pin in worker)
```ts
// Enroll (during signup or migration; MK already in worker):
svrWrapFromUnlocked(args: { unblinded: Uint8Array }): Promise<{ wrappedMkSvr: Uint8Array }>;
// Unlock:
svrUnlock(args: { unblinded: Uint8Array; wrappedMkSvr: Uint8Array }): Promise<void>; // KEK_pin→unwrap→loadIdentity
// Change PIN (unlocked):
svrRewrapFromUnlocked(args: { unblinded: Uint8Array }): Promise<{ wrappedMkSvr: Uint8Array }>;
```
Implementation reuses `kekFromOprf` + existing `wrapKey`/`unwrapKey`/`loadIdentity`/`unlockWithRawMk` logic. (Blind/unblind can live in worker too; only `blinded`/`eval` go to the client to POST.)

> Note: `bootstrap()` currently derives KEK from a passphrase. For passwordless signup, generate MK + mnemonic the same way but skip the passphrase wrapper; wrap MK under `KEK_pin` via `svrWrapFromUnlocked`. Add a `bootstrapPasswordless()` or parameterize `bootstrap()`.

### 3c. `lib/repos/cryptoRepo.ts` — new client functions (mirror existing)
```ts
postSvrEnrollBegin(): Promise<void>;
postSvrEval(blinded: Uint8Array): Promise<{ eval: Uint8Array }>;   // 423 → throw Locked
postSvrEnrollFinish(wrappedMkSvr: Uint8Array): Promise<void>;
postSvrResetCounter(): Promise<void>;
postSvrChangePin(wrappedMkSvr: Uint8Array): Promise<void>;
getSvrStatus(): Promise<{ enrolled: boolean; attemptsLeft: number; locked: boolean }>;
```
Extend `getBundle()` to also return `hasSvr`/`wrappedMkSvr`.

### 3d. Orchestration (page/hook)
- Unlock: `oprfBlind(pin)` → `postSvrEval` → `oprfUnblind` → `worker.svrUnlock({unblinded, wrappedMkSvr})` → on success `postSvrResetCounter` + `exportMkForSession` (existing session-restore).
- Enroll/signup: `worker.bootstrapPasswordless()` → `postBootstrap` (pubkeys + recovery) → `postSvrEnrollBegin` → OPRF → `worker.svrWrapFromUnlocked` → `postSvrEnrollFinish`.

## 4. UI
- `PinSetupScreen`, `PinUnlockScreen`, `ChangePinScreen` (block trivial PINs, show attempts-left from `getSvrStatus`).
- Remove passphrase from the **new-signup** path; keep passphrase unlock available for migration.
- Onboarding: require a backstop — wire existing `setupTrusteeShamir` and show the 12-word Recovery Kit (from `bootstrap().mnemonic`).

## 5. Recovery / forgot-PIN (mostly already there)
- Forgot PIN, browser has session/passkey → unlock → `ChangePin`.
- Forgot PIN, locked out → **Shamir** (`unlockWithShamir`, built) or mnemonic (`unlockWithMnemonic`, built) → MK in worker → `svrRewrapFromUnlocked` + `kcs.rotate` → new PIN.

## 6. Vectors / CI
- Freeze the `<TBD>` entries in `crypto-vectors.json` (kdf, mnemonic, keypair, blind_index) using `scripts/generate-crypto-vectors.py`.
- Add OPRF vectors. CI on both repos asserts byte-identical OPRF + KEK.

## 7. Phased order (each independently shippable)
1. **Auth Bearer fix** (`requireClientUser`) — unblocks mobile, low risk.
2. **Migration** (`wrapped_mk_svr`, `svr_records`) + **KCS adapter** (pick backend).
3. **`oprf.ts`** + vectors (freeze + OPRF).
4. **SVR routes** (`eval`, `enroll`, `reset-counter`, `change-pin`, `status`) + counter/lockout + `kcs.destroy`.
5. **Worker + cryptoRepo** SVR methods; extend `bootstrap`/`bundle`.
6. **PIN UI** + onboarding backstop; remove passphrase from new signup.
7. **Migration prompt** for existing passphrase users → set PIN → enroll SVR.
8. Deprecate/remove `wrapped_mk_pass` after adoption window.

## 8. Decisions (CONFIRMED 2026-05-24)
- **KCS backend**: **Supabase Vault** (pgsodium) for MVP. `svr_secret` encrypted at rest by the Vault root key (held outside the DB by Supabase), `attempt_count` in `svr_records`. Documented weaker property: a *full Supabase project compromise* (DB + Vault root key) could brute-force the PIN offline — 6-digit (1M space) raises the bar; revisit AWS/GCP KMS before scale. A plain SQL dump lacks the Vault root key → secret stays inert.
- **PIN length**: **6 digits** (1,000,000 space). Enforce exactly 6; block trivial PINs (`000000`, `123456`, repeats, sequences).
- **Encryption model**: zero-knowledge (confirmed). Option A (Appendix A of `E2EE_PASSWORDLESS_WEB.md`) is NOT chosen.

## 9. Effort
- New: `oprf.ts`, `kcs.ts`, 5 routes, 3 worker methods, ~6 repo funcs, migration, PIN screens, vectors.
- Changed: `bootstrap`/`bundle` routes, `requireClientUser`, worker `bootstrap`.
- Untouched: entire data-plane (`aead`, `streamAead`, `envelope`, `keyManager`, vault routes) + Shamir + mnemonic recovery.
