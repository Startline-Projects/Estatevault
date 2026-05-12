import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/api/auth";
import { b64decode } from "@/lib/api/crypto";

export const runtime = "nodejs";

const Schema = z.object({
  labelBlind: z.string().min(1),
  category: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid payload" }, { status: 400 });

  let labelBlind: Uint8Array;
  try { labelBlind = b64decode(parsed.data.labelBlind); }
  catch { return NextResponse.json({ error: "bad base64" }, { status: 400 }); }
  if (labelBlind.length !== 32) return NextResponse.json({ error: "bad label_blind length" }, { status: 400 });

  const admin = createAdminClient();
  const { data: client } = await admin.from("clients").select("id").eq("profile_id", user.id).single();
  if (!client) return NextResponse.json({ items: [] });

  let q = admin
    .from("vault_items")
    .select("id, category, ciphertext, nonce, enc_version, storage_path, created_at")
    .eq("client_id", client.id)
    .eq("label_blind", labelBlind);
  if (parsed.data.category) q = q.eq("category", parsed.data.category);

  const { data: items } = await q;
  return NextResponse.json({ items: items ?? [] });
}
