import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireClientUser, bytesToBytea, byteaToBytes } from "@/lib/api/crypto";
import { getOrCreateUserDek } from "@/lib/api/dek";
import { deriveSubKey, INFO, zero } from "@/lib/crypto/keyManager";
import { encryptBytes, decryptBytes } from "@/lib/crypto/aead";
import { blindIndex, normalize } from "@/lib/crypto/blindIndex";

export const runtime = "nodejs";

// Option A (server-managed encryption): clients send/receive PLAINTEXT over TLS.
// The server unwraps the per-user DEK, derives sub-keys, and encrypts/decrypts
// vault payloads with the existing EV01 (XChaCha20-Poly1305) format.

const CATEGORIES = [
  "estate_document", "insurance", "financial_account", "digital_account",
  "physical_location", "contact", "final_wishes", "business",
] as const;

const PostSchema = z.object({
  category: z.enum(CATEGORIES),
  label: z.string().min(1).max(500),
  data: z.record(z.string(), z.unknown()).default({}),
  storagePath: z.string().optional(),
});

type PlainItem = {
  id: string;
  category: string;
  label: string;
  data: Record<string, unknown>;
  storagePath: string | null;
  encrypted: boolean;
  createdAt: string;
};

export async function GET(req: NextRequest) {
  const ctx = await requireClientUser(req, { autoCreate: true });
  if ("error" in ctx) return ctx.error;
  const { admin, client } = ctx;

  const { data: rows } = await admin
    .from("vault_items")
    .select("id, category, ciphertext, storage_path, created_at")
    .eq("client_id", client.id)
    .order("created_at", { ascending: false });

  if (!rows || rows.length === 0) return NextResponse.json({ items: [] });

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
          items.push({ id: r.id, category: r.category, label: parsed.label, data: parsed.data, storagePath: r.storage_path, encrypted: true, createdAt: r.created_at });
        } catch {
          items.push({ id: r.id, category: r.category, label: "[decryption failed]", data: {}, storagePath: r.storage_path, encrypted: true, createdAt: r.created_at });
        }
      } else {
        items.push({ id: r.id, category: r.category, label: "", data: {}, storagePath: r.storage_path, encrypted: false, createdAt: r.created_at });
      }
    }
  } finally {
    zero(dbKey);
    zero(dek);
  }

  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const ctx = await requireClientUser(request, { autoCreate: true });
  if ("error" in ctx) return ctx.error;
  const { admin, user, client } = ctx;

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }
  const p = parsed.data;

  const dek = await getOrCreateUserDek(admin, client);
  const dbKey = await deriveSubKey(dek, INFO.DB);
  const indexKey = await deriveSubKey(dek, INFO.INDEX);
  let insertRow: Record<string, unknown>;
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

  const { data: item, error } = await admin
    .from("vault_items")
    .insert(insertRow)
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "vault.item_added",
    resource_type: "vault_item",
    resource_id: item.id,
    metadata: { category: p.category, encrypted: true },
  }).then(() => undefined, () => undefined);

  return NextResponse.json({ item });
}

export async function PATCH(request: NextRequest) {
  const ctx = await requireClientUser(request);
  if ("error" in ctx) return ctx.error;
  const { admin, user, client } = ctx;

  let body: { id?: string; label?: string; data?: Record<string, unknown> };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const { id, label, data } = body;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { data: existing } = await admin
    .from("vault_items")
    .select("client_id, ciphertext")
    .eq("id", id)
    .single();
  if (!existing || existing.client_id !== client.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const dek = await getOrCreateUserDek(admin, client);
  const dbKey = await deriveSubKey(dek, INFO.DB);
  const indexKey = await deriveSubKey(dek, INFO.INDEX);
  let update: Record<string, unknown>;
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

  const { error } = await admin.from("vault_items").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "vault.item_updated",
    resource_type: "vault_item",
    resource_id: id,
  }).then(() => undefined, () => undefined);

  return NextResponse.json({ item: { id } });
}

export async function DELETE(request: NextRequest) {
  const ctx = await requireClientUser(request);
  if ("error" in ctx) return ctx.error;
  const { admin, user, client } = ctx;

  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("id");
  if (!itemId) return NextResponse.json({ error: "Missing item id" }, { status: 400 });

  const { data: item } = await admin
    .from("vault_items")
    .select("client_id, ciphertext")
    .eq("id", itemId)
    .single();
  if (!item || item.client_id !== client.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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
        return NextResponse.json({ error: "Auto-generated items cannot be deleted" }, { status: 403 });
      }
    } catch {
      // Undecryptable row — allow deletion.
    } finally {
      zero(dbKey);
      zero(dek);
    }
  }

  await admin.from("vault_items").delete().eq("id", itemId);
  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "vault.item_deleted",
    resource_type: "vault_item",
    resource_id: itemId,
  }).then(() => undefined, () => undefined);

  return NextResponse.json({ success: true });
}
