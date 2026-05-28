import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/api/auth";
import { b64decode, bytesToBytea, validateEnvelope } from "@/lib/api/crypto";
import { apiRateLimit } from "@/lib/rate-limit";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import * as clientRepo from "@/lib/repos/server/clientRepo";
import * as vaultItemRepo from "@/lib/repos/server/vaultItemRepo";
import * as trusteeRepo from "@/lib/repos/server/trusteeRepo";
import * as farewellRepo from "@/lib/repos/server/farewellRepo";
import { backfillEncryptSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

const MAX_CT = 1_048_576;

function decodeOrFail(s: string, expectedLen?: number): Uint8Array {
  const b = b64decode(s);
  if (expectedLen != null && b.length !== expectedLen) throw new Error(`bad length (got ${b.length}, want ${expectedLen})`);
  return b;
}

export const POST = withRoute(async (req: NextRequest) => {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Unauthorized", 401);

  const rl = await apiRateLimit.limit(`backfill-encrypt:${user.id}`);
  if (!rl.success) return fail("rate limited", 429);

  let body: unknown;
  try { body = await req.json(); } catch { return fail("bad json", 400); }
  const parsed = backfillEncryptSchema.safeParse(body);
  if (!parsed.success) return fail("invalid payload", 400, { details: parsed.error.flatten() });

  const admin = createAdminClient();
  const { data: client } = await clientRepo.getIdByProfile(admin, user.id);
  if (!client) return fail("no client", 400);

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
          const { error, count } = await vaultItemRepo.encryptRow(admin, row.id, client.id, update);
          if (error) throw new Error(error.message);
          if ((count ?? 0) === 0) throw new Error("row already backfilled or not owned");
          break;
        }
        case "vault_trustees": {
          if (row.emailBlind) update.email_blind = bytesToBytea(decodeOrFail(row.emailBlind, 32));
          update.trustee_name = "";
          update.trustee_email = "";
          update.trustee_relationship = "";
          const { error, count } = await trusteeRepo.encryptRow(admin, row.id, client.id, update);
          if (error) throw new Error(error.message);
          if ((count ?? 0) === 0) throw new Error("row already backfilled or not owned");
          break;
        }
        case "farewell_messages": {
          if (row.recipientBlind) update.recipient_blind = bytesToBytea(decodeOrFail(row.recipientBlind, 32));
          update.title = "";
          update.recipient_email = "";
          const { error, count } = await farewellRepo.encryptRow(admin, row.id, client.id, update);
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

  return ok({ updated, failed });
});
