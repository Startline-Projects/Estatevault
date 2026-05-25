import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireClientUser, bytesToBytea } from "@/lib/api/crypto";
import { getOrCreateUserDek } from "@/lib/api/dek";
import { deriveSubKey, INFO, zero } from "@/lib/crypto/keyManager";
import { blindIndex, normalize } from "@/lib/crypto/blindIndex";

export const runtime = "nodejs";

// Option A: client sends the plaintext query label. Server derives the index
// sub-key, computes the blind index, and matches it server-side.
const Schema = z.object({
  label: z.string().min(1).max(500),
  category: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const ctx = await requireClientUser(req, { autoCreate: true });
  if ("error" in ctx) return ctx.error;
  const { admin, client } = ctx;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid payload" }, { status: 400 });

  const dek = await getOrCreateUserDek(admin, client);
  const indexKey = await deriveSubKey(dek, INFO.INDEX);
  let blindHex: string;
  try {
    blindHex = bytesToBytea(blindIndex(indexKey, normalize(parsed.data.label)));
  } finally {
    zero(indexKey);
    zero(dek);
  }

  let q = admin
    .from("vault_items")
    .select("id, category")
    .eq("client_id", client.id)
    .eq("label_blind", blindHex);
  if (parsed.data.category) q = q.eq("category", parsed.data.category);

  const { data: items } = await q;
  return NextResponse.json({ items: items ?? [] });
}
