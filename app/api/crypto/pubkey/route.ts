import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { b64encode, byteaToBytes, checkRate, limiters, logAudit } from "@/lib/api/crypto";
import { pubkeyQuerySchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export const GET = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const { admin, user, profile } = auth;

  const rl = await checkRate(limiters.bundle, `pubkey:${user.id}`);
  if (rl) return rl;

  const { searchParams } = new URL(req.url);
  const parsed = pubkeyQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return fail("invalid query", 400);

  let recipientUserId = parsed.data.userId;
  if (!recipientUserId && parsed.data.email) {
    const { data: prof } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", parsed.data.email)
      .maybeSingle();
    if (!prof) return fail("recipient not registered", 404);
    recipientUserId = prof.id;
  }

  const { data: client } = await admin
    .from("clients")
    .select("pubkey_x25519, enc_version")
    .eq("profile_id", recipientUserId!)
    .maybeSingle();

  if (!client?.pubkey_x25519) return fail("recipient has no E2EE setup", 404);

  await logAudit(admin, {
    actor_id: profile.id,
    action: "crypto.pubkey.lookup",
    meta: { recipient_user_id: recipientUserId },
  });

  return ok({
    userId: recipientUserId,
    pubX25519: b64encode(byteaToBytes(client.pubkey_x25519)),
    encVersion: client.enc_version ?? 1,
  });
});
