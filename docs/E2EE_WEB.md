# EstateVault — Web (Next.js) E2EE Implementation Plan

Web repo: `/Users/xamir/Desktop/Glo Staffing/Estatevault`
Stack: Next.js 14 App Router · React 18 · TypeScript · `@supabase/ssr` · Tailwind · pnpm · Vercel · Upstash · Stripe · Resend.

Client-side end-to-end encryption. All vault content encrypted in-browser before upload. Backend = existing **Next.js API routes** (`app/api/*`). Mobile calls the **same** API routes — one backend, two clients.

---

## 1. Scope

- All vault content (documents, videos, trustees, contacts, life events, farewell) encrypted on device before upload.
- Master key (MK) derived from passphrase via Argon2id (WASM).
- BIP39 24-word mnemonic recovery.
- Identical crypto contract with mobile (`docs/E2EE_MOBILE.md`).
- Web is the canonical backend host — mobile hits `https://app.estatevault.com/api/*`.

---

## 2. Architecture

```
┌─────────────────────────┐    ┌─────────────────────────┐
│ Web (Next.js, React)    │    │ Mobile (Flutter)        │
│ ┌─────────────────────┐ │    │ ┌─────────────────────┐ │
│ │ @estatevault/crypto │ │    │ │ estatevault_crypto  │ │
│ │ (TS, libsodium WASM)│ │    │ │ (Dart, sodium_libs) │ │
│ └─────────────────────┘ │    │ └─────────────────────┘ │
│ ┌─────────────────────┐ │    │ ┌─────────────────────┐ │
│ │ Crypto Web Worker   │ │    │ │ KeySession provider │ │
│ └─────────────────────┘ │    │ └─────────────────────┘ │
│ ┌─────────────────────┐ │    │ ┌─────────────────────┐ │
│ │ Repo client → fetch │ │    │ │ Repo client → http  │ │
│ └─────────┬───────────┘ │    │ └─────────┬───────────┘ │
└───────────┼─────────────┘    └───────────┼─────────────┘
            │ ciphertext + JSON           │
            └──────────┬──────────────────┘
                       ▼
        ┌──────────────────────────────────┐
        │ Next.js API routes (shared)      │
        │  app/api/vault/*                 │
        │  app/api/documents/*             │
        │  app/api/farewell/*              │
        │  app/api/crypto/*  ← NEW         │
        │  app/api/share/*   ← NEW         │
        │                                  │
        │  - Verify Supabase JWT           │
        │  - Resolve client_id             │
        │  - Use service-role admin client │
        │  - Insert into audit_log         │
        │  - Mint signed storage URLs      │
        │  - NEVER sees plaintext or MK    │
        └──────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────┐
        │ Supabase                         │
        │  - Postgres (ciphertext only)    │
        │  - Storage (opaque .bin)         │
        │  - Auth                          │
        └──────────────────────────────────┘
```

---

## 3. Dependencies (add to `package.json`)

```json
{
  "dependencies": {
    "libsodium-wrappers-sumo": "^0.7.13",
    "bip39": "^3.1.0",
    "@noble/hashes": "^1.4.0",
    "comlink": "^4.4.1",
    "zxcvbn": "^4.4.2"
  },
  "devDependencies": {
    "@types/libsodium-wrappers-sumo": "^0.7.8",
    "@types/zxcvbn": "^4.4.5"
  }
}
```

Already present: `@supabase/ssr`, `@supabase/supabase-js`, `@upstash/ratelimit`, `@upstash/redis`, `zod`. Reuse.

---

## 4. Crypto Package (`@estatevault/crypto`)

Place at `packages/crypto-js/` if you adopt monorepo, or `lib/crypto/` for in-repo.

```
lib/crypto/
├── index.ts             # public API
├── kdf.ts               # Argon2id
├── aead.ts              # XChaCha20-Poly1305
├── streamAead.ts        # secretstream chunks
├── envelope.ts          # magic + version + nonce + ct + tag
├── keyManager.ts        # MK / sub-key derivation
├── mnemonic.ts          # BIP39
├── sharing.ts           # X25519 box / box_seal
├── blindIndex.ts        # HMAC-SHA256 search index
├── worker/
│   ├── crypto.worker.ts # Comlink-exposed implementation
│   └── client.ts        # main-thread proxy
└── __tests__/
    ├── vectors.test.ts  # passes shared vectors.json
    └── roundtrip.test.ts
```

Public API (matches Dart):

```ts
deriveKEK(passphrase, salt, params) -> Uint8Array
generateMasterKey() -> Uint8Array
wrapKey(mk, kek) -> Envelope
unwrapKey(env, kek) -> Uint8Array
deriveSubKey(mk, info: string) -> Uint8Array

encryptBytes(key, plaintext) -> Envelope
decryptBytes(key, envelope) -> Uint8Array
encryptStream(key, ReadableStream) -> ReadableStream
decryptStream(key, ReadableStream) -> ReadableStream

generateMnemonic() / mnemonicToMasterKey(m)
generateX25519() / wrapForRecipient / unwrapFromSender
blindIndex(key, normalized) -> Uint8Array
```

CI: load `vectors.json` (shared with mobile) and assert byte-identical outputs.

---

## 5. Web Worker for Crypto

Why: Argon2 (m=64MB) blocks main thread ~1s. Run in dedicated worker via Comlink. MK never leaves worker scope — main thread holds opaque handles only. Reduces XSS exfiltration risk.

```
lib/crypto/worker/crypto.worker.ts → exposes EvCrypto
lib/crypto/worker/client.ts        → typed wrapper used by repos
```

Bundling: Next.js 14 supports `new Worker(new URL("./crypto.worker.ts", import.meta.url))`. Verify `next.config.mjs` doesn't strip workers — likely no change needed.

---

## 6. Key Session

- MK lives **only inside worker** as `Uint8Array`.
- Tab close → worker terminates → MK gone.
- 15-min idle (`visibilitychange` + activity timer) → worker zeros MK, posts `locked`. UI shows lock screen.
- Never persist MK/KEK/DEK to `localStorage`, `sessionStorage`, IndexedDB, cookies.
- Supabase Auth refresh token persists as before (managed by `@supabase/ssr`).

---

## 7. Schema Migration

Add new migration: `supabase/migrations/migration-e2ee-phase1.sql`

```sql
-- USERS / PROFILES: store crypto material on the profile that owns auth.uid()
ALTER TABLE clients
  ADD COLUMN kdf_salt            bytea,
  ADD COLUMN kdf_params          jsonb,
  ADD COLUMN wrapped_mk_pass     bytea,
  ADD COLUMN wrapped_mk_recovery bytea,
  ADD COLUMN pubkey_x25519       bytea,
  ADD COLUMN pubkey_ed25519      bytea,
  ADD COLUMN enc_version         smallint DEFAULT 1,
  ADD COLUMN crypto_setup_at     timestamptz;

-- VAULT_ITEMS: ciphertext columns; keep label/data during dual-write
ALTER TABLE vault_items
  ADD COLUMN ciphertext     bytea,
  ADD COLUMN nonce          bytea,
  ADD COLUMN enc_version    smallint,
  ADD COLUMN label_blind    bytea,   -- HMAC-SHA256 of normalized label
  ADD COLUMN backfilled_at  timestamptz;

CREATE INDEX vault_items_label_blind_idx ON vault_items (label_blind);

-- TRUSTEES (currently joined data): add ciphertext on trustee row
ALTER TABLE trustees
  ADD COLUMN ciphertext     bytea,
  ADD COLUMN nonce          bytea,
  ADD COLUMN enc_version    smallint;

-- ITEM SHARES: per-item DEK wrapped to recipient pubkey
CREATE TABLE item_shares (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id            uuid REFERENCES vault_items(id) ON DELETE CASCADE,
  recipient_user_id  uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  wrapped_dek        bytea NOT NULL,
  sender_pubkey      bytea NOT NULL,
  created_at         timestamptz DEFAULT now()
);

ALTER TABLE item_shares ENABLE ROW LEVEL SECURITY;
-- Service-role only access (API routes use admin client). Block direct anon access.
CREATE POLICY shares_no_direct ON item_shares FOR ALL USING (false);
```

Storage bucket policy: tighten `documents` + `farewell-videos` to **deny anon**; only service-role (i.e. Next.js API) can upload/download. All client access goes via signed URLs minted in API routes.

---

## 8. New / Updated API Routes

Backend pattern in this repo: API routes use `createAdminClient()` (service role) after auth check. Same pattern for new endpoints.

### New routes

```
app/api/crypto/
  bootstrap/route.ts        POST  — first-time setup (write wrapped keys + pubkeys)
  bundle/route.ts           GET   — returns {salt, params, wrapped_mk_pass, enc_version}
  recovery-bundle/route.ts  GET   — returns {salt, params, wrapped_mk_recovery}
  rotate-passphrase/route.ts POST — replace wrapped_mk_pass
  rotate-recovery/route.ts   POST — replace wrapped_mk_recovery
  pubkey/route.ts            GET  — fetch user pubkey for sharing

app/api/share/
  route.ts                   GET (incoming) | POST (create) | DELETE (revoke)

app/api/vault/items/
  route.ts                   UPDATE: accept ciphertext+nonce+label_blind, drop label/data
  search/route.ts            POST  — search by label_blind

app/api/vault/upload-document/
  route.ts                   UPDATE: accept opaque .bin, no MIME sniffing, signed URL flow

app/api/vault/upload-url/route.ts   POST — mint signed PUT URL for documents bucket
app/api/vault/download-url/route.ts POST — mint signed GET URL

app/api/vault/farewell/upload-url/route.ts   POST — mint signed PUT for farewell-videos
app/api/vault/farewell/download-url/route.ts POST — mint signed GET
```

### Updated routes

- `app/api/vault/items/route.ts` — POST/DELETE write/read ciphertext columns. Validate envelope: magic = `EV01`, version byte, length sanity.
- `app/api/vault/upload-document/route.ts` — accept arbitrary `.bin`; remove `application/pdf` MIME check (server can't see content); enforce only **size** (20 MB documents, 500 MB videos).
- `app/api/documents/*` — generated PDFs (will, trust, etc.) need separate handling: generated server-side from plaintext quiz data → **encrypt server-side with a public-key send to user** OR push generation to client. See §15.

### Shared helper

`lib/api/auth.ts` — already exists conceptually. Add:
```ts
export async function requireUser() { ... }
export async function requireClient() { return {user, client, admin} }
export function validateEnvelope(buf: Uint8Array) { ... }  // magic + version + min length
```

### Rate limiting (already have Upstash)

Apply to:
- `crypto/bundle` — 10/min per IP per user (slow brute force).
- `crypto/recovery-bundle` — 3/min per IP per user.
- `crypto/bootstrap` — 1/hour per user.
- `vault/upload-url` — 60/min per user.

---

## 9. Repo Layer (browser side)

Existing data flows live in components (`components/dashboard/*`) calling `fetch("/api/vault/items")`. Refactor into a **client repo layer** at `lib/repos/`:

```
lib/repos/
├── vaultRepo.ts          # CRUD with encrypt/decrypt
├── documentRepo.ts       # signed URL upload/download + stream encrypt
├── videoRepo.ts          # farewell videos, chunked secretstream
├── trusteeRepo.ts
├── shareRepo.ts
└── cryptoRepo.ts         # bootstrap, bundle, rotate
```

Pattern:

```ts
// CREATE
const dek = await crypto.deriveSubKey("ev:dek:db:v1");
const env = await crypto.encryptBytes(dek, encode(JSON.stringify({ label, data })));
await fetch("/api/vault/items", {
  method: "POST",
  body: JSON.stringify({
    category,
    ciphertext: b64(env.bytes),
    nonce: b64(env.nonce),
    enc_version: 1,
    label_blind: b64(await crypto.blindIndex(indexKey, normalize(label))),
  }),
});
```

```ts
// UPLOAD FILE
const fileKey = await crypto.deriveSubKey("ev:dek:files:v1");
const { signedUrl, path } = await fetch("/api/vault/upload-url", {
  method: "POST",
  body: JSON.stringify({ kind: "document" }),
}).then(r => r.json());

const cipherStream = await crypto.encryptStream(fileKey, file.stream());
await fetch(signedUrl, { method: "PUT", body: cipherStream, duplex: "half" });

// Then create vault_items row (ciphertext metadata) referencing path
```

Refactor existing components (`FarewellUploader.tsx`, `FarewellRecorder.tsx`, vault dashboard pages under `app/dashboard/vault/`, trustee settings under `app/dashboard/settings/`) to call `lib/repos/*` instead of raw fetch.

---

## 10. UX Flows

### 10a. New signup
1. Existing Supabase signup unchanged.
2. After email verify → redirect `/onboarding/vault-passphrase`.
3. Page: passphrase + confirm + zxcvbn meter.
4. Worker derives keys, generates mnemonic.
5. Page: `/onboarding/recovery-phrase` — show 24 words, force confirm 3 random words.
6. POST `/api/crypto/bootstrap`.

### 10b. Login
1. Standard Supabase signin.
2. After redirect to `/dashboard`, modal: "Unlock vault" (passphrase).
3. GET `/api/crypto/bundle` → unwrap MK in worker.
4. Modal closes; vault data decrypts inline.

### 10c. Forgot passphrase
1. `/recover` → 24-word input.
2. GET `/api/crypto/recovery-bundle` → unwrap MK via mnemonic.
3. New passphrase → POST `/api/crypto/rotate-passphrase`.

### 10d. Idle lock
- 15-min idle → worker zeros MK; UI pushes lock modal.
- Resume → re-prompt passphrase only (Supabase session still valid).

---

## 11. Server-Generated PDFs (will, trust, funding instructions)

This is the **hardest** part of going E2EE on web — these are currently generated server-side from quiz answers using `pdf-lib` / `pdfkit` / `@react-pdf/renderer`.

Two options:

### Option A — Move generation to client (preferred for E2EE purity)
- Bundle templates + `pdf-lib` into client.
- Quiz answers stay encrypted at rest; client decrypts → generates PDF → encrypts → uploads.
- Server only stores ciphertext.
- Cost: ~300 KB extra JS; one-time migration of templates from `lib/documents/templates/` to client.

### Option B — Keep server generation, encrypt-on-delivery
- Quiz answers stored ciphertext. Client posts decrypted answers + user's pubkey to `/api/documents/generate`.
- Server generates PDF, encrypts to user's pubkey via `crypto_box_seal`, uploads ciphertext, returns key path.
- Server sees plaintext **transiently** during generation but never persists.
- Easier migration; weaker E2EE guarantee.

**Recommendation: Option A** for vault items the user uploads themselves; Option B accepted only for system-generated docs with explicit user consent + audit log.

---

## 12. Middleware + Route Guards

`middleware.ts` already runs Supabase session refresh. Add:

```ts
// middleware.ts (after updateSession)
if (pathname.startsWith("/dashboard") && !request.cookies.get("ev-vault-unlocked")) {
  // Set cookie client-side after worker unlocks MK; server only checks presence.
}
```

Cookie is **non-sensitive flag only** (no key material). Vault routes always re-check via API by trying to fetch `/api/crypto/bundle` (still requires user passphrase to actually decrypt).

---

## 13. CSP + Web Hardening

Add to `next.config.mjs`:

```js
headers: async () => [{
  source: "/:path*",
  headers: [
    { key: "Content-Security-Policy", value: cspString },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
  ],
}]
```

CSP for `/dashboard/*`:
```
default-src 'self';
script-src 'self' 'wasm-unsafe-eval';
style-src 'self' 'unsafe-inline';   # tighten with nonce later
connect-src 'self' https://*.supabase.co https://*.upstash.io;
img-src 'self' blob: data: https://*.supabase.co;
worker-src 'self' blob:;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
```

Other:
- SRI on `libsodium-wrappers-sumo` if served from CDN (pin to local bundle to avoid).
- Trusted Types for vault routes.
- No third-party analytics or tag managers on `/dashboard/*` or `/vault/*`.
- Sandbox iframe for decrypted PDF preview.

---

## 14. Lint / Safety Rules

- ESLint rule: ban direct `supabase.from("vault_items")` outside `lib/repos/`.
- ESLint rule: ban raw `fetch("/api/vault/...")` outside `lib/repos/`.
- Branded types: `type MK = Uint8Array & { __brand: "MK" }`.
- Forbid `console.log` of branded key types (custom rule).
- Test: snapshot any new API route response — must not include plaintext fields.

---

## 15. Backfill (existing user data)

After passphrase setup, MK held in worker. Background backfill task in browser:

```ts
async function backfillVault() {
  while (true) {
    const { rows } = await fetch("/api/vault/backfill/fetch?limit=50").then(r => r.json());
    if (!rows.length) break;
    for (const r of rows) {
      const env = await crypto.encryptBytes(dek, encode(JSON.stringify({ label: r.label, data: r.data })));
      await fetch("/api/vault/backfill/encrypt", {
        method: "POST",
        body: JSON.stringify({
          id: r.id,
          ciphertext: b64(env.bytes),
          nonce: b64(env.nonce),
          label_blind: b64(await crypto.blindIndex(indexKey, normalize(r.label))),
        }),
      });
    }
  }
}
```

`POST /api/vault/backfill/encrypt` writes ciphertext columns and **nulls** `label` + `data` in the same transaction. Storage objects re-uploaded as `.bin`, originals deleted.

Track via `clients.crypto_backfill_complete_at`.

---

## 16. Phases / Timeline (Web)

| Phase | Task | Days |
|---|---|---|
| W0 | Add `lib/crypto/`, vector tests, worker scaffolding | 3 |
| W1 | KeySession + idle lock + worker proxy | 2 |
| W2 | Migration SQL + RLS lockdown | 1 |
| W3 | API routes: `crypto/bootstrap`, `crypto/bundle`, rotate | 2 |
| W4 | Onboarding UX: passphrase + mnemonic | 4 |
| W5 | Login modal + recovery flow | 3 |
| W6 | `lib/repos/vaultRepo.ts` + refactor `app/dashboard/vault/*` | 3 |
| W7 | `documentRepo` + signed URL routes + refactor uploaders | 3 |
| W8 | `videoRepo` + farewell stream encrypt + refactor `FarewellRecorder/Uploader` | 3 |
| W9 | `trusteeRepo` + refactor `app/dashboard/settings/*` | 2 |
| W10 | Sharing API + UI | 3 |
| W11 | Server-PDF migration (Option A: client-side will/trust render) | 4 |
| W12 | Backfill task + admin verification queries | 2 |
| W13 | CSP/headers/lint guards | 2 |
| W14 | QA + parity tests vs mobile fixtures | 3 |

**~40 dev-days web.**

---

## 17. Web-Specific Hardening

1. **Strict CSP** — `script-src 'self' 'wasm-unsafe-eval'`; no `unsafe-inline`/`unsafe-eval`.
2. **SRI / local bundle** — pin libsodium WASM hash; serve from same origin.
3. **Trusted Types** — require sanitizer for any `innerHTML` on vault routes.
4. **Web Worker isolation** — MK on worker only; main thread holds opaque IDs.
5. **Service Worker rules** — never cache decrypted blobs or API responses with ciphertext bodies (avoid persistent ciphertext on disk in the browser).
6. **Login throttling** — Upstash counter on `/api/crypto/bundle` and `/api/crypto/recovery-bundle`. Lockout on 10 fails / hour.
7. **CSRF** — Supabase JWT in `Authorization`; SameSite=lax on auth cookie; double-submit token on state-changing API routes.
8. **Dependency pinning** — `pnpm` lockfile + Dependabot/Snyk; manual review for `libsodium-wrappers-sumo`, `bip39`, `pdf-lib`.
9. **Sandboxed iframe preview** — render decrypted PDFs in `sandbox="allow-scripts allow-same-origin"` only when needed; prefer `sandbox=""`.
10. **No third-party scripts on `/dashboard`** — strip GA/Hotjar/Intercom from vault routes.
11. **Clipboard scrub** — paste/copy of passphrase/mnemonic clears clipboard after 30 s.
12. **Print/screenshot warning** — overlay on unlock screens; warn extensions can read page.
13. **HSTS preload** — submit domain to preload list.
14. **WebAuthn 2FA** — passkey for login (optional but recommended).
15. **Memory wipe on hidden tab** — `visibilitychange` + 5-min grace → worker zeros MK.

---

## 18. Security Suggestions (extra hardening)

1. Per-item DEK (not one global file DEK).
2. Origin-bound HKDF info — mix `app.estatevault.com` into `info` strings; ciphertext only decrypts from your domain.
3. WebAuthn / passkey-wrapped MK as third recovery slot.
4. Argon2 calibration with floor (m=64MB, t=3); refuse to downgrade.
5. Padded ciphertext to size buckets.
6. Per-field blind index salt to prevent cross-field correlation.
7. Signed audit log — client signs every mutation with Ed25519.
8. Forward-secret sharing via `crypto_box_seal` (ephemeral sender key).
9. Out-of-band SAS for trustee verification.
10. Dead-man switch — time-locked share unlock.
11. Decoy vault — second passphrase opens decoy.
12. Crypto-shred deletion — erase wrapped_dek; ciphertext becomes garbage.
13. 90-day periodic re-wrap of MK.
14. Rate-limit unwrap (Upstash).
15. hCaptcha on signup + recovery.
16. Open-source `lib/crypto/` for external review.
17. Bug bounty.
18. External audit (Trail of Bits / Cure53 / NCC) before GA.
19. Compliance posture: SOC 2 Type II + HIPAA scope (Supabase HIPAA-eligible).
20. Privacy policy + DPA updated to disclose E2EE + data-loss risk.

---

## 19. Acceptance Criteria

- [ ] Vector tests pass against shared `vectors.json`.
- [ ] Signup → mnemonic → login → recovery work end-to-end.
- [ ] DB inspection of `vault_items` row = ciphertext only.
- [ ] Storage object download = opaque bytes.
- [ ] Service-role admin query returns no plaintext PII.
- [ ] Web signup + mobile login decrypts the same items (and vice versa).
- [ ] Idle lock fires after 15 min; resume re-prompts.
- [ ] Backfill drains plaintext to zero.
- [ ] CSP report-only logs zero violations on `/dashboard/*`.
- [ ] No `unsafe-inline` / `unsafe-eval` in production CSP.
- [ ] All `/api/*` routes reject unauthenticated requests.
- [ ] Server-generated PDFs (will/trust) flow uses Option A (client render) or Option B with consent + audit row.

---

## 20. Shared with Mobile

- `docs/CRYPTO_SPEC.md` — single source of truth.
- `vectors.json` — binding contract; CI-blocking on both sides.
- Backend = `app/api/*` in this repo. Mobile hits `https://app.estatevault.com/api/*`.
- Schema migrations live here (`supabase/migrations/`); mobile reads only.
- Storage buckets owned here.
