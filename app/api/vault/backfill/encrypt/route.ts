import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/api/auth";
import { b64decode, bytesToBytea, validateEnvelope } from "@/lib/api/crypto";
import { apiRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const RowSchema = z.object({
  id: z.string().uuid(),
  ciphertext: z.string().min(1),
  nonce: z.string().min(1),
  encVersion: z.number().int().optional(),
  // Optional blinds depending on table.
  labelBlind: z.string().optional(),
  emailBlind: z.string().optional(),
  recipientBlind: z.string().optional(),
});

const Schema = z.object({
  table: z.enum(["vault_items", "vault_trustees", "farewell_messages"]),
  rows: z.array(RowSchema).min(1).max(100),
});

const MAX_CT = 1_048_576;

function decodeOrFail(s: string, expectedLen?: number): Uint8Array {
  const b = b64decode(s);
  if (expectedLen != null && b.length !== expectedLen) throw new Error(`bad length (got ${b.length}, want ${expectedLen})`);
  return b;
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await apiRateLimit.limit(`backfill-encrypt:${user.id}`);
  if (!rl.success) return NextResponse.json({ error: "rate limited" }, { status: 429 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid payload", details: parsed.error.flatten() }, { status: 400 });

  const admin = createAdminClient();
  const { data: client } = await admin.from("clients").select("id").eq("profile_id", user.id).single();
  if (!client) return NextResponse.json({ error: "no client" }, { status: 400 });

  const updated: string[] = [];
  const failed: { id: string; error: string }[] = [];

  for (const row of parsed.data.rows) {
    try {
      const ct = decodeOrFail(row.ciphertext);
      const nonce = decodeOrFail(row.nonce, 24);
      if (ct.length > MAX_CT) throw new Error("ciphertext too large");
      validateEnvelope(ct, MAX_CT);

      const update: Record<string, unknown> = {
        ciphertext: bytesToBytea(ct),
        nonce: bytesToBytea(nonce),
        enc_version: row.encVersion ?? 1,
        backfilled_at: new Date().toISOString(),
      };

      switch (parsed.data.table) {
        case "vault_items": {
          if (row.labelBlind) update.label_blind = bytesToBytea(decodeOrFail(row.labelBlind, 32));
          // NULL plaintext columns
          update.label = null;
          update.data = null;
          // Idempotent guard: only update if ciphertext is still NULL + row owned by client.
          const { error, count } = await admin
            .from("vault_items")
            .update(update, { count: "exact" })
            .eq("id", row.id)
            .eq("client_id", client.id)
            .is("ciphertext", null);
          if (error) throw new Error(error.message);
          if ((count ?? 0) === 0) throw new Error("row already backfilled or not owned");
          break;
        }
        case "vault_trustees": {
          if (row.emailBlind) update.email_blind = bytesToBytea(decodeOrFail(row.emailBlind, 32));
          update.trustee_name = "";
          update.trustee_email = "";
          update.trustee_relationship = "";
          const { error, count } = await admin
            .from("vault_trustees")
            .update(update, { count: "exact" })
            .eq("id", row.id)
            .eq("client_id", client.id)
            .is("ciphertext", null);
          if (error) throw new Error(error.message);
          if ((count ?? 0) === 0) throw new Error("row already backfilled or not owned");
          break;
        }
        case "farewell_messages": {
          if (row.recipientBlind) update.recipient_blind = bytesToBytea(decodeOrFail(row.recipientBlind, 32));
          update.title = "";
          update.recipient_email = "";
          const { error, count } = await admin
            .from("farewell_messages")
            .update(update, { count: "exact" })
            .eq("id", row.id)
            .eq("client_id", client.id)
            .is("ciphertext", null);
          if (error) throw new Error(error.message);
          if ((count ?? 0) === 0) throw new Error("row already backfilled or not owned");
          break;
        }
      }
      updated.push(row.id);
    } catch (e) {
      failed.push({ id: row.id, error: (e as Error).message });
    }
  }

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "vault.backfill.batch",
    metadata: { table: parsed.data.table, updated: updated.length, failed: failed.length },
  }).then(() => undefined, () => undefined);

  return NextResponse.json({ updated, failed });
}
