import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, type UserType } from "./auth";
import {
  cryptoBundleRateLimit,
  cryptoRecoveryRateLimit,
  cryptoBootstrapRateLimit,
  cryptoRotateRateLimit,
} from "@/lib/rate-limit";

// ---- Helpers ----

export function b64encode(b: Uint8Array): string {
  return Buffer.from(b).toString("base64");
}

// Supabase returns bytea as a `\xHEX` string. Normalize to Uint8Array.
export function byteaToBytes(v: unknown): Uint8Array {
  if (v == null) return new Uint8Array();
  if (v instanceof Uint8Array) return v;
  if (Buffer.isBuffer(v)) return new Uint8Array(v);
  if (Array.isArray(v)) return new Uint8Array(v as number[]);
  if (typeof v === "string") {
    if (v.startsWith("\\x") || v.startsWith("\\X")) {
      return new Uint8Array(Buffer.from(v.slice(2), "hex"));
    }
    // Fall back: assume base64.
    return new Uint8Array(Buffer.from(v, "base64"));
  }
  if (typeof v === "object" && v !== null && "type" in (v as object) && (v as { type?: string }).type === "Buffer") {
    return new Uint8Array(((v as unknown) as { data: number[] }).data);
  }
  throw new Error("unrecognized bytea value");
}

export function b64decode(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, "base64"));
}

// Encode Uint8Array as PostgreSQL bytea hex literal (`\x...`).
// Supabase JS sends JSON; passing a Uint8Array stringifies to `{"0":..,"1":..}`
// which PostgREST cannot parse as bytea. Always pass binary as `\x<hex>` text.
export function bytesToBytea(b: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < b.length; i++) hex += b[i].toString(16).padStart(2, "0");
  return "\\x" + hex;
}

// EV01 envelope sanity check (does NOT verify auth tag — server has no key).
const MAGIC = [0x45, 0x56, 0x30, 0x31];
const HEADER_LEN = 29;
const TAG_LEN = 16;
export function validateEnvelope(buf: Uint8Array, maxLen = 1024) {
  if (buf.length < HEADER_LEN + TAG_LEN) throw new Error("envelope too short");
  if (buf.length > maxLen) throw new Error("envelope too large");
  for (let i = 0; i < 4; i++) if (buf[i] !== MAGIC[i]) throw new Error("bad magic");
  if (buf[4] !== 1) throw new Error("unsupported enc_version");
}

// ---- Auth + client lookup ----

export async function requireClientUser(_req: NextRequest, opts: { autoCreate?: boolean } = {}) {
  const auth = await requireAuth(["client"] as UserType[]);
  if ("error" in auth) return { error: auth.error };
  const { admin, user, profile } = auth;

  const selectCols = "id, profile_id, kdf_salt, kdf_params, wrapped_mk_pass, wrapped_mk_recovery, pubkey_x25519, pubkey_ed25519, enc_version, crypto_setup_at";

  let { data: client, error } = await admin
    .from("clients")
    .select(selectCols)
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (!client && opts.autoCreate) {
    const { data: created, error: insErr } = await admin
      .from("clients")
      .insert({ profile_id: profile.id, source: "direct" })
      .select(selectCols)
      .single();
    if (insErr || !created) {
      console.error("[crypto.requireClientUser] client insert failed", { profile_id: profile.id, insErr });
      return { error: NextResponse.json({ error: "client create failed", detail: insErr?.message ?? "unknown" }, { status: 500 }) };
    }
    client = created;
    error = null;
  }

  if (error || !client) {
    return { error: NextResponse.json({ error: "client not found" }, { status: 404 }) };
  }
  return { admin, user, profile, client };
}

// ---- Rate limit shim ----

export async function checkRate(limiter: typeof cryptoBundleRateLimit, key: string) {
  const r = await limiter.limit(key);
  if (!r.success) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }
  return null;
}

export const limiters = {
  bundle: cryptoBundleRateLimit,
  recovery: cryptoRecoveryRateLimit,
  bootstrap: cryptoBootstrapRateLimit,
  rotate: cryptoRotateRateLimit,
};

// ---- Schemas ----

const bytesB64 = z.string().min(1).max(8192);

export const KdfParamsSchema = z.object({
  alg: z.literal("argon2id"),
  m: z.number().int().min(65536).max(1048576),
  t: z.number().int().min(3).max(10),
  p: z.number().int().min(1).max(4),
  v: z.number().int().min(1),
});

export const BootstrapSchema = z.object({
  salt: bytesB64,
  kdfParams: KdfParamsSchema,
  wrappedMkPass: bytesB64,
  wrappedMkRecovery: bytesB64,
  pubX25519: bytesB64,
  pubEd25519: bytesB64,
});

export const RotatePassphraseSchema = z.object({
  salt: bytesB64,
  kdfParams: KdfParamsSchema,
  wrappedMkPass: bytesB64,
});

export const RotateRecoverySchema = z.object({
  wrappedMkRecovery: bytesB64,
});

export const ShamirSetupSchema = z.object({
  shareA: bytesB64,           // encoded [index + value], 33 bytes
  shareC: bytesB64,           // encoded [index + value], 33 bytes (server encrypts)
  wrappedMkShamir: bytesB64,  // MK wrapped under shamir master_key
  shamirVersion: z.number().int().min(1).max(255),
});

// ---- Audit ----

export async function logAudit(
  admin: ReturnType<typeof import("./auth").createAdminClient>,
  args: { actor_id: string; action: string; meta?: Record<string, unknown> },
) {
  // audit_log schema: actor_id, action, resource_type?, resource_id?, metadata.
  await admin.from("audit_log").insert({
    actor_id: args.actor_id,
    action: args.action,
    metadata: args.meta ?? {},
  }).then(() => undefined, () => undefined);
}
