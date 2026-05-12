import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/api/auth";
import { b64decode, b64encode, validateEnvelope } from "@/lib/api/crypto";
import { apiRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

// --- Schemas ---

const CreateSchema = z.object({
  itemId: z.string().uuid(),
  recipientUserId: z.string().uuid(),
  wrappedDek: z.string().min(1),       // crypto_box_seal output, base64
  senderPubkey: z.string().min(1),     // owner X25519 pub at share time, base64
  encVersion: z.number().int().optional(),
});

// --- Helpers ---

async function getMyClient(admin: ReturnType<typeof createAdminClient>, profileId: string) {
  const { data } = await admin
    .from("clients")
    .select("id")
    .eq("profile_id", profileId)
    .single();
  return data;
}

// --- GET ---
// ?direction=in   → shares where I'm the recipient
// ?direction=out  → shares I created (default, scoped to my client_id)
// optional ?itemId for owner-side filter

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await apiRateLimit.limit(`share-list:${user.id}`);
  if (!rl.success) return NextResponse.json({ error: "rate limited" }, { status: 429 });

  const url = new URL(req.url);
  const direction = url.searchParams.get("direction") ?? "out";
  const itemId = url.searchParams.get("itemId");

  const admin = createAdminClient();

  if (direction === "in") {
    // Pull rows where I'm recipient. Return ciphertext + wrapped_dek so the
    // browser can decrypt without a separate item fetch.
    const { data: shares } = await admin
      .from("item_shares")
      .select(`
        id, item_id, owner_client_id, wrapped_dek, sender_pubkey, enc_version, created_at,
        vault_items:item_id ( id, category, ciphertext, nonce, enc_version, storage_path, created_at )
      `)
      .eq("recipient_user_id", user.id)
      .is("revoked_at", null)
      .order("created_at", { ascending: false });

    return NextResponse.json({
      shares: (shares ?? []).map((s) => ({
        id: s.id,
        itemId: s.item_id,
        wrappedDek: s.wrapped_dek instanceof Uint8Array ? b64encode(s.wrapped_dek) : s.wrapped_dek,
        senderPubkey: s.sender_pubkey instanceof Uint8Array ? b64encode(s.sender_pubkey) : s.sender_pubkey,
        encVersion: s.enc_version,
        createdAt: s.created_at,
        item: s.vault_items,
      })),
    });
  }

  // Outgoing
  const client = await getMyClient(admin, user.id);
  if (!client) return NextResponse.json({ shares: [] });

  let q = admin
    .from("item_shares")
    .select("id, item_id, recipient_user_id, enc_version, created_at, revoked_at")
    .eq("owner_client_id", client.id);
  if (itemId) q = q.eq("item_id", itemId);

  const { data: shares } = await q.order("created_at", { ascending: false });
  return NextResponse.json({ shares: shares ?? [] });
}

// --- POST ---  create a share

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await apiRateLimit.limit(`share-create:${user.id}`);
  if (!rl.success) return NextResponse.json({ error: "rate limited" }, { status: 429 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }
  const p = parsed.data;

  let wrappedDek: Uint8Array, senderPub: Uint8Array;
  try {
    wrappedDek = b64decode(p.wrappedDek);
    senderPub = b64decode(p.senderPubkey);
  } catch {
    return NextResponse.json({ error: "bad base64" }, { status: 400 });
  }

  // crypto_box_seal output = ephemeral_pub(32) || ciphertext + tag(48). Min 80B.
  if (wrappedDek.length < 80 || wrappedDek.length > 256) {
    return NextResponse.json({ error: "bad wrapped_dek length" }, { status: 400 });
  }
  if (senderPub.length !== 32) {
    return NextResponse.json({ error: "bad sender_pubkey length" }, { status: 400 });
  }

  const admin = createAdminClient();
  const client = await getMyClient(admin, user.id);
  if (!client) return NextResponse.json({ error: "No client record" }, { status: 400 });

  // Verify ownership of the item.
  const { data: item } = await admin
    .from("vault_items")
    .select("id, client_id")
    .eq("id", p.itemId)
    .single();
  if (!item || item.client_id !== client.id) {
    return NextResponse.json({ error: "item not found or not owned" }, { status: 404 });
  }

  // Verify recipient has E2EE bootstrap.
  const { data: rec } = await admin
    .from("clients")
    .select("pubkey_x25519")
    .eq("profile_id", p.recipientUserId)
    .maybeSingle();
  if (!rec?.pubkey_x25519) {
    return NextResponse.json({ error: "recipient has no E2EE setup" }, { status: 404 });
  }

  // Upsert (re-share replaces revoked row).
  const { error } = await admin
    .from("item_shares")
    .upsert({
      item_id: p.itemId,
      owner_client_id: client.id,
      recipient_user_id: p.recipientUserId,
      wrapped_dek: wrappedDek,
      sender_pubkey: senderPub,
      enc_version: p.encVersion ?? 1,
      revoked_at: null,
    }, { onConflict: "item_id,recipient_user_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "share.created",
    resource_type: "vault_item",
    resource_id: p.itemId,
    metadata: { recipient_user_id: p.recipientUserId },
  }).then(() => undefined, () => undefined);

  return NextResponse.json({ ok: true });
}

// --- DELETE ---  revoke (owner only)

export async function DELETE(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await apiRateLimit.limit(`share-revoke:${user.id}`);
  if (!rl.success) return NextResponse.json({ error: "rate limited" }, { status: 429 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const admin = createAdminClient();
  const client = await getMyClient(admin, user.id);
  if (!client) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify the row belongs to my client.
  const { data: row } = await admin
    .from("item_shares")
    .select("id, owner_client_id, item_id, recipient_user_id")
    .eq("id", id)
    .single();
  if (!row || row.owner_client_id !== client.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Soft revoke (keep audit trail of past wraps). Crypto-shred would require
  // rotating the item DEK and re-encrypting; deferred to UI-driven workflow.
  const { error } = await admin
    .from("item_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "share.revoked",
    resource_type: "vault_item",
    resource_id: row.item_id,
    metadata: { recipient_user_id: row.recipient_user_id },
  }).then(() => undefined, () => undefined);

  // Suppress unused-import warning when validateEnvelope not used here.
  void validateEnvelope;

  return NextResponse.json({ ok: true });
}
