# Option A — Server-Managed (Recoverable) Encryption: Implementation Plan (Web + Mobile)

Chosen 2026-05-24 for user ease. Server holds the keys → forgot password = easy email reset, no data loss; both clients sync trivially. **Not zero-knowledge** — server can decrypt; no "E2E / we can't see your data" marketing.

Grounded in the current web code (`lib/crypto/*`, `app/api/*`, `clients`/`vault_items` schema). Supersedes `SVR_IMPL_WEB.md`.

---

## 1. Architecture

```
Client (web React / Flutter mobile)
  ├─ Supabase auth (email+password + MFA)  → JWT
  ├─ App lock: 6-digit PIN / biometric (UX only, NOT a key)
  └─ sends PLAINTEXT vault data over TLS
        │ HTTPS + JWT (cookie on web, Bearer on mobile)
        ▼
Next.js API (app/api/*)  ── the only place crypto happens
  ├─ requireClientUser() → auth
  ├─ unwrap per-user DEK via Supabase Vault (KEK)
  ├─ encrypt/decrypt with DEK using existing libsodium (lib/crypto/aead,streamAead)
  └─ store/read ciphertext in Postgres / Storage
        ▼
Supabase: Postgres (ciphertext) + Storage (.bin) + Vault (KEK)  — server can decrypt
```

Encryption runs **server-side** in the API routes (libsodium-wrappers-sumo runs in Node, same lib the worker uses → reuse `aead.ts`/`streamAead.ts`/`envelope.ts` as-is on the server). Clients send/receive plaintext over TLS.

## 2. Key custody — envelope encryption with Supabase Vault

```
Vault data ──AES/XChaCha20 (existing EV01/EVS1)──> ciphertext, encrypted with per-user DEK
DEK (32B, per user) ──wrapped by──> KEK (single app key in Supabase Vault / pgsodium)
Postgres clients.wrapped_dek = wrapped DEK     (inert without the Vault KEK)
Supabase Vault: KEK — not in normal DB dumps
Runtime: API reads wrapped_dek → unwrap via Vault → DEK in memory → encrypt/decrypt → discard
```

- One KEK in Vault (rotatable). Per-user DEK so blast radius is per-user and DEK rotation is possible.
- No plaintext keys at rest. Server *capability* to unwrap is the (accepted) tradeoff.
- Optionally derive per-table sub-keys from DEK with existing `deriveSubKey` (`INFO.*`).

## 3. Schema changes

```sql
-- per-user data key, wrapped by the Vault KEK
ALTER TABLE clients ADD COLUMN IF NOT EXISTS wrapped_dek bytea;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS dek_setup_at timestamptz;

-- Supabase Vault: create one secret holding the KEK (id referenced in env/config)
-- select vault.create_secret('<base64 KEK>', 'ev_kek_v1', 'EstateVault master KEK');
```
Reuse existing `vault_items.ciphertext/nonce/enc_version` columns — only **who encrypts** changes (server, not client). Blind-index columns become optional (server can query plaintext in-memory or index normally after decrypt); keep them harmless.

## 4. Web changes (file-level)

### 4a. Server key service — `lib/api/dek.ts` (new)
```ts
getKek(): Promise<Uint8Array>;                       // read from Supabase Vault (cached in memory)
getOrCreateUserDek(admin, clientId): Promise<Uint8Array>;  // unwrap clients.wrapped_dek, or create+wrap+store
```
Uses existing `wrapKey`/`unwrapKey`/`generateMasterKey` from `lib/crypto/keyManager` (run server-side).

### 4b. Vault routes — encrypt server-side
- `app/api/vault/items/route.ts`:
  - **POST**: accept **plaintext** `{label, data}` → `dek = getOrCreateUserDek()` → `encryptBytes(deriveSubKey(dek, INFO.DB), plaintext)` → store ciphertext/nonce. (Was: store client ciphertext.)
  - **GET**: read ciphertext → decrypt server-side → return **plaintext** JSON.
- `app/api/vault/upload-url` + `download-url` / `download-document`: for files, either (a) server streams-encrypt on upload via `streamAead` before writing to Storage, or (b) keep signed-URL upload but have the client send plaintext to a server endpoint that encrypts. Simplest MVP: route file bytes through the API and encrypt with `streamAead` server-side.
- Apply same pattern to `trustees`, `farewell` routes.

### 4c. Auth — `lib/api/crypto.ts` `requireClientUser` / `lib/api/auth.ts`
Add `Authorization: Bearer <jwt>` support (`admin.auth.getUser(jwt)`) alongside cookie auth → unblocks mobile.

### 4d. Signup
On client bootstrap (or first vault write), server calls `getOrCreateUserDek()` → provisions + stores `wrapped_dek`. No passphrase, no mnemonic required.

### 4e. Forgot password
Standard Supabase `resetPasswordForEmail` → new login password → full access (keys are server-side). **No data loss.** This is the whole point.

### 4f. App lock (optional UX)
6-digit PIN / biometric gate to open the app; resettable via re-login. Not tied to encryption.

### 4g. Heir / Deputy access
Server grants a designated recipient read access (re-encrypt/serve under access control) on a death/incapacity trigger. Reuse existing trustee tables; no client crypto sharing protocol needed.

### 4h. Retire (or repurpose) zero-knowledge client crypto
`lib/crypto/worker/*`, `cryptoRepo.ts` passphrase/SVR/mnemonic/shamir paths are **no longer needed for vault data**. Options: delete, or keep `worker` for an optional **partial hybrid** (client-encrypt only the most sensitive fields like account passwords with a user-only key, so even staff can't read those). Recommend: keep dormant, decide hybrid later.

## 5. Mobile changes — thin client

- `supabase_flutter` auth + **Bearer token** to the web API.
- Vault repos (`lib/features/vault/data/*_repository.dart`): call the web API, receive **plaintext**, render. **No crypto package, no SVR, no device-key wrapping.** (Big simplification vs zero-knowledge plan.)
- `local_auth` biometric + 6-digit PIN as a local app-lock; "forgot PIN" → re-login.
- Secure storage only for the Supabase refresh token.
- Files: download plaintext (or server-decrypted stream) via the API.

Sync is automatic: both clients hit the same API; the server decrypts for both.

## 6. Existing-data migration — RESOLVED 2026-05-24: pre-launch → WIPE

No real user data. Wipe existing zero-knowledge vault data and recreate under Option A. No passphrase-based migration.

Cleanup migration:
- Delete rows in `vault_items`, `vault_trustees`, `farewell_messages`, `item_shares` (+ Storage objects in `documents` / `farewell-videos` buckets).
- Reset `clients` zero-knowledge columns to NULL: `kdf_salt`, `kdf_params`, `wrapped_mk_pass`, `wrapped_mk_recovery`, `pubkey_x25519`, `pubkey_ed25519`, `crypto_setup_at` (old bundle unused under Option A).
- Drop the unused zero-knowledge columns later once Option A is stable.

## 7. Security requirements (Option A)

- KEK in **Supabase Vault** only; never an env-var/plaintext key beside the DB.
- Per-user DEK; TLS everywhere; MFA; RLS; **audit-log every server decrypt**.
- Least-privilege service role; alert on bulk/anomalous decrypts.
- Optional partial hybrid for top-secret fields (§4h).

## 8. Phases
1. **Auth Bearer fix** (`requireClientUser`) — unblocks mobile, low risk.
2. **Supabase Vault KEK** + migration (`clients.wrapped_dek`) + `lib/api/dek.ts`.
3. **Vault routes** → server-side encrypt/decrypt (`items` first, then files, trustees, farewell).
4. **Signup DEK provisioning** + forgot-password (already Supabase-native).
5. **Wipe old zero-knowledge data** (§6) — pre-launch, no migration code.
6. **Mobile** thin client: auth + repos render plaintext + app-lock.
7. **Heir/Deputy** server-side access; audit logging; retire/repurpose worker crypto.

## 9. What gets reused vs retired
- **Reuse:** `lib/crypto/{aead,streamAead,envelope,keyManager}.ts` (server-side now), ciphertext columns, trustee tables, route/auth/audit patterns.
- **Retire for vault data:** worker MK custody, passphrase/SVR/mnemonic/shamir unlock, client `cryptoRepo` crypto calls.
- **Add:** `lib/api/dek.ts`, Vault KEK, `wrapped_dek`, Bearer auth, server-side encrypt in vault routes, mobile thin client.
