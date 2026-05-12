import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/api/auth";
import { b64decode, bytesToBytea, validateEnvelope } from "@/lib/api/crypto";

export const runtime = "nodejs";

const CATEGORIES = [
  "estate_document", "insurance", "financial_account", "digital_account",
  "physical_location", "contact", "final_wishes", "business",
] as const;

// Dual-write payload: either legacy {label,data} (pre-E2EE clients) OR
// E2EE {ciphertext,nonce,label_blind,enc_version}. Backfill (Phase 13) drains
// any rows still on the legacy path.
const PostSchema = z.object({
  category: z.enum(CATEGORIES),
  // E2EE path
  ciphertext: z.string().optional(),
  nonce: z.string().optional(),
  labelBlind: z.string().optional(),
  encVersion: z.number().int().optional(),
  storagePath: z.string().optional(),
  // Legacy path (deprecated; allowed during rollout)
  label: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
}).refine(
  (v) => (v.ciphertext && v.nonce) || v.label,
  { message: "must provide ciphertext+nonce OR legacy label" },
);

const MAX_CT = 1_048_576; // 1 MiB ceiling for inline ciphertext

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: client } = await admin.from("clients").select("id").eq("profile_id", user.id).single();
  if (!client) return NextResponse.json({ items: [] });

  // Select both legacy + E2EE columns. Repo decides which to decrypt.
  const { data: items } = await admin
    .from("vault_items")
    .select("id, client_id, category, label, data, ciphertext, nonce, enc_version, label_blind, storage_path, backfilled_at, created_at, updated_at")
    .eq("client_id", client.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ items: items ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }
  const p = parsed.data;

  let ciphertext: Uint8Array | null = null;
  let nonce: Uint8Array | null = null;
  let labelBlind: Uint8Array | null = null;

  if (p.ciphertext && p.nonce) {
    try {
      ciphertext = b64decode(p.ciphertext);
      nonce = b64decode(p.nonce);
      if (p.labelBlind) labelBlind = b64decode(p.labelBlind);
    } catch {
      return NextResponse.json({ error: "bad base64" }, { status: 400 });
    }
    if (ciphertext.length > MAX_CT) {
      return NextResponse.json({ error: "ciphertext too large" }, { status: 413 });
    }
    try { validateEnvelope(ciphertext, MAX_CT); } catch (e) {
      return NextResponse.json({ error: `envelope invalid: ${(e as Error).message}` }, { status: 400 });
    }
    if (nonce.length !== 24) return NextResponse.json({ error: "bad nonce length" }, { status: 400 });
    if (labelBlind && labelBlind.length !== 32) return NextResponse.json({ error: "bad label_blind length" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: client } = await admin.from("clients").select("id").eq("profile_id", user.id).single();
  if (!client) return NextResponse.json({ error: "No client record" }, { status: 400 });

  const insertRow: Record<string, unknown> = { client_id: client.id, category: p.category };
  if (ciphertext) {
    insertRow.ciphertext = bytesToBytea(ciphertext);
    insertRow.nonce = bytesToBytea(nonce!);
    insertRow.enc_version = p.encVersion ?? 1;
    if (labelBlind) insertRow.label_blind = bytesToBytea(labelBlind);
    if (p.storagePath) insertRow.storage_path = p.storagePath;
    // Legacy columns left NULL.
    insertRow.label = "";
    insertRow.data = {};
    insertRow.backfilled_at = new Date().toISOString();
  } else {
    insertRow.label = p.label ?? "";
    insertRow.data = p.data ?? {};
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
    metadata: { category: p.category, encrypted: !!ciphertext },
  }).then(() => undefined, () => undefined);

  return NextResponse.json({ item });
}

export async function DELETE(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("id");
  if (!itemId) return NextResponse.json({ error: "Missing item id" }, { status: 400 });

  const admin = createAdminClient();
  const { data: client } = await admin.from("clients").select("id").eq("profile_id", user.id).single();
  if (!client) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: item } = await admin
    .from("vault_items")
    .select("client_id, data, ciphertext")
    .eq("id", itemId)
    .single();
  if (!item || item.client_id !== client.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Auto-generated items (linked to an order) still have order_id stamped in `data`.
  // Encrypted items can't be auto-generated yet, so this check only applies to legacy rows.
  const itemData = (item.data ?? {}) as Record<string, unknown>;
  if (itemData?.order_id) return NextResponse.json({ error: "Auto-generated items cannot be deleted" }, { status: 403 });

  await admin.from("vault_items").delete().eq("id", itemId);
  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "vault.item_deleted",
    resource_type: "vault_item",
    resource_id: itemId,
  }).then(() => undefined, () => undefined);

  return NextResponse.json({ success: true });
}
