import { NextRequest } from "next/server";
import { requireClientUser, bytesToBytea, byteaToBytes } from "@/lib/api/crypto";
import { getOrCreateUserDek } from "@/lib/api/dek";
import { deriveSubKey, INFO, zero } from "@/lib/crypto/keyManager";
import { encryptBytes, decryptBytes } from "@/lib/crypto/aead";
import { blindIndex, normalize } from "@/lib/crypto/blindIndex";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import * as vaultItemRepo from "@/lib/repos/server/vaultItemRepo";
import { vaultItemSchema } from "@/lib/validation/schemas";
import type { Database } from "@/types/db.generated";

type VaultItemInsert = Database["public"]["Tables"]["vault_items"]["Insert"];
type VaultItemUpdate = Database["public"]["Tables"]["vault_items"]["Update"];

export const runtime = "nodejs";

// Option A (server-managed encryption): clients send/receive PLAINTEXT over TLS.
// The server unwraps the per-user DEK, derives sub-keys, and encrypts/decrypts
// vault payloads with the existing EV01 (XChaCha20-Poly1305) format.

type PlainItem = {
  id: string;
  category: string;
  label: string;
  data: Record<string, unknown>;
  storagePath: string | null;
  encrypted: boolean;
  createdAt: string;
};

export const GET = withRoute(async (req: NextRequest) => {
  const ctx = await requireClientUser(req, { autoCreate: true });
  if ("error" in ctx) return ctx.error;
  const { admin, client } = ctx;

  const { data: rows, error: listErr } = await vaultItemRepo.listByClient(admin, client.id);

  // Don't render a transient DB failure as "your vault is empty".
  if (listErr) {
    console.error("[vault/items GET]", listErr);
    return fail("could not load vault", 500);
  }
  if (!rows || rows.length === 0) return ok({ items: [] });

  const dek = await getOrCreateUserDek(admin, client);
  const dbKey = await deriveSubKey(dek, INFO.DB);
  const items: PlainItem[] = [];
  try {
    for (const r of rows) {
      const ct = byteaToBytes(r.ciphertext);
      if (ct.length > 0) {
        try {
          const pt = await decryptBytes(dbKey, ct);
          const parsed = JSON.parse(new TextDecoder().decode(pt)) as { label: string; data: Record<string, unknown> };
          items.push({ id: r.id, category: r.category, label: parsed.label, data: parsed.data, storagePath: r.storage_path, encrypted: true, createdAt: r.created_at ?? "" });
        } catch {
          items.push({ id: r.id, category: r.category, label: "[decryption failed]", data: {}, storagePath: r.storage_path, encrypted: true, createdAt: r.created_at ?? "" });
        }
      } else {
        items.push({ id: r.id, category: r.category, label: "", data: {}, storagePath: r.storage_path, encrypted: false, createdAt: r.created_at ?? "" });
      }
    }
  } finally {
    zero(dbKey);
    zero(dek);
  }

  return ok({ items });
});

export const POST = withRoute(async (request: NextRequest) => {
  const ctx = await requireClientUser(request, { autoCreate: true });
  if ("error" in ctx) return ctx.error;
  const { admin, user, client } = ctx;

  let body: unknown;
  try { body = await request.json(); } catch { return fail("bad json", 400); }
  const parsed = vaultItemSchema.safeParse(body);
  if (!parsed.success) {
    return fail("invalid payload", 400, { details: parsed.error.flatten() });
  }
  const p = parsed.data;

  const dek = await getOrCreateUserDek(admin, client);
  const dbKey = await deriveSubKey(dek, INFO.DB);
  const indexKey = await deriveSubKey(dek, INFO.INDEX);
  let insertRow: VaultItemInsert;
  try {
    const payload = new TextEncoder().encode(JSON.stringify({ label: p.label, data: p.data }));
    const env = await encryptBytes(dbKey, payload);
    const labelBlind = blindIndex(indexKey, normalize(p.label));
    insertRow = {
      client_id: client.id,
      category: p.category,
      ciphertext: bytesToBytea(env.bytes),
      nonce: bytesToBytea(env.nonce),
      enc_version: 1,
      label_blind: bytesToBytea(labelBlind),
      storage_path: p.storagePath ?? null,
      label: "",
      data: {},
      backfilled_at: new Date().toISOString(),
    };
  } finally {
    zero(indexKey);
    zero(dbKey);
    zero(dek);
  }

  const { data: item, error } = await vaultItemRepo.insert(admin, insertRow);

  if (error) {
    console.error("[vault/items POST]", error);
    return fail("could not save item", 500);
  }

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "vault.item_added",
    resource_type: "vault_item",
    resource_id: item.id,
    metadata: { category: p.category, encrypted: true },
  }).then(() => undefined, () => undefined);

  return ok({ item });
});

export const PATCH = withRoute(async (request: NextRequest) => {
  const ctx = await requireClientUser(request);
  if ("error" in ctx) return ctx.error;
  const { admin, user, client } = ctx;

  let body: { id?: string; label?: string; data?: Record<string, unknown> };
  try { body = await request.json(); } catch { return fail("bad json", 400); }
  const { id, label, data } = body;
  if (!id) return fail("Missing id", 400);

  const { data: existing } = await vaultItemRepo.getOwnerAndCiphertext(admin, id);
  if (!existing || existing.client_id !== client.id) {
    return fail("Not found", 404);
  }

  const dek = await getOrCreateUserDek(admin, client);
  const dbKey = await deriveSubKey(dek, INFO.DB);
  const indexKey = await deriveSubKey(dek, INFO.INDEX);
  let update: VaultItemUpdate;
  try {
    let curLabel = "";
    let curData: Record<string, unknown> = {};
    const ct = byteaToBytes(existing.ciphertext);
    if (ct.length > 0) {
      try {
        const pt = await decryptBytes(dbKey, ct);
        const parsed = JSON.parse(new TextDecoder().decode(pt)) as { label: string; data: Record<string, unknown> };
        curLabel = parsed.label ?? "";
        curData = parsed.data ?? {};
      } catch { /* re-encrypt fresh */ }
    }
    const newLabel = label ?? curLabel;
    const newData = data ?? curData;
    const env = await encryptBytes(dbKey, new TextEncoder().encode(JSON.stringify({ label: newLabel, data: newData })));
    update = {
      ciphertext: bytesToBytea(env.bytes),
      nonce: bytesToBytea(env.nonce),
      label_blind: bytesToBytea(blindIndex(indexKey, normalize(newLabel))),
      updated_at: new Date().toISOString(),
    };
  } finally {
    zero(indexKey);
    zero(dbKey);
    zero(dek);
  }

  const { error } = await vaultItemRepo.updateForOwner(admin, id, client.id, update);
  if (error) {
    console.error("[vault/items PATCH]", error);
    return fail("could not update item", 500);
  }

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "vault.item_updated",
    resource_type: "vault_item",
    resource_id: id,
  }).then(() => undefined, () => undefined);

  return ok({ item: { id } });
});

export const DELETE = withRoute(async (request: NextRequest) => {
  const ctx = await requireClientUser(request);
  if ("error" in ctx) return ctx.error;
  const { admin, user, client } = ctx;

  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("id");
  if (!itemId) return fail("Missing item id", 400);

  const { data: item } = await vaultItemRepo.getOwnerAndCiphertext(admin, itemId);
  if (!item || item.client_id !== client.id) {
    return fail("Not found", 404);
  }

  // Auto-generated items (linked to an order) stamp order_id inside the encrypted
  // payload. Decrypt to check before allowing deletion.
  const ct = byteaToBytes(item.ciphertext);
  if (ct.length > 0) {
    const dek = await getOrCreateUserDek(admin, client);
    const dbKey = await deriveSubKey(dek, INFO.DB);
    try {
      const pt = await decryptBytes(dbKey, ct);
      const parsed = JSON.parse(new TextDecoder().decode(pt)) as { data?: Record<string, unknown> };
      if (parsed.data?.order_id) {
        return fail("Auto-generated items cannot be deleted", 403);
      }
    } catch {
      // Undecryptable row — allow deletion.
    } finally {
      zero(dbKey);
      zero(dek);
    }
  }

  await vaultItemRepo.deleteForOwner(admin, itemId, client.id);
  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "vault.item_deleted",
    resource_type: "vault_item",
    resource_id: itemId,
  }).then(() => undefined, () => undefined);

  return ok({ success: true });
});
