// Option A (server-managed encryption) key service.
// KEK lives in Supabase Vault (or EV_KEK_BASE64 for local dev). Each client has
// a per-user DEK wrapped under the KEK. API routes call getOrCreateUserDek() to
// obtain the raw DEK in memory, derive sub-keys, and encrypt/decrypt vault data.

import { generateMasterKey, wrapKey, unwrapKey } from "@/lib/crypto/keyManager";
import { byteaToBytes, bytesToBytea } from "./crypto";
import { createAdminClient } from "./auth";

type Admin = ReturnType<typeof createAdminClient>;

const KEK_LEN = 32;
let kekCache: Uint8Array | null = null;

// Fetch the app-wide KEK. Cached in module memory for the process lifetime.
export async function getKek(admin?: Admin): Promise<Uint8Array> {
  if (kekCache) return kekCache;

  // Local/dev/test fallback — base64 of 32 raw bytes.
  const envKek = process.env.EV_KEK_BASE64;
  if (envKek) {
    const k = new Uint8Array(Buffer.from(envKek, "base64"));
    if (k.length !== KEK_LEN) throw new Error("EV_KEK_BASE64 must decode to 32 bytes");
    kekCache = k;
    return k;
  }

  const db = admin ?? createAdminClient();
  const { data, error } = await db.rpc("app_get_kek", { p_name: "ev_kek_v1" });
  if (error) throw new Error(`KEK fetch failed: ${error.message}`);
  if (!data || typeof data !== "string") throw new Error("KEK not found in Vault");
  const kek = new Uint8Array(Buffer.from(data, "base64"));
  if (kek.length !== KEK_LEN) throw new Error("KEK must be 32 bytes");
  kekCache = kek;
  return kek;
}

// Return the raw per-user DEK, provisioning + persisting one on first use.
// Uses conditional UPDATE to prevent TOCTOU race: only writes if wrapped_dek IS NULL.
export async function getOrCreateUserDek(
  admin: Admin,
  client: { id: string; wrapped_dek?: unknown },
): Promise<Uint8Array> {
  const kek = await getKek(admin);

  const existing = client.wrapped_dek ? byteaToBytes(client.wrapped_dek) : null;
  if (existing && existing.length > 0) {
    return unwrapKey(existing, kek);
  }

  const dek = await generateMasterKey();
  const wrapped = await wrapKey(dek, kek);

  // Conditional write: only succeeds if no other request wrote first
  const { data: updated } = await admin
    .from("clients")
    .update({ wrapped_dek: bytesToBytea(wrapped.bytes), dek_setup_at: new Date().toISOString() })
    .eq("id", client.id)
    .is("wrapped_dek", null)
    .select("wrapped_dek")
    .maybeSingle();

  if (updated?.wrapped_dek) {
    // We won the race — return our DEK
    return dek;
  }

  // Another request wrote first — re-read and unwrap the winner's DEK
  const { data: freshClient, error: readErr } = await admin
    .from("clients")
    .select("wrapped_dek")
    .eq("id", client.id)
    .single();
  if (readErr || !freshClient?.wrapped_dek) {
    throw new Error("DEK write race: unable to read winning DEK");
  }
  return unwrapKey(byteaToBytes(freshClient.wrapped_dek), kek);
}

// Test/rotation helper — clears the cached KEK.
export function _resetKekCache(): void {
  kekCache = null;
}
