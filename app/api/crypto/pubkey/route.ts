import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api/auth";
import { b64encode, byteaToBytes, checkRate, limiters, logAudit } from "@/lib/api/crypto";

export const runtime = "nodejs";

// Lookup recipient pubkey for sharing.
// Allow either:
//   ?email=foo@bar.com   (must already be registered EstateVault user)
//   ?userId=<auth.users.id>
// Returns X25519 pub only (Ed25519 not needed for sharing).
const QuerySchema = z.object({
  email: z.string().email().optional(),
  userId: z.string().uuid().optional(),
}).refine(v => !!(v.email || v.userId), { message: "email or userId required" });

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const { admin, user, profile } = auth;

  const rl = await checkRate(limiters.bundle, `pubkey:${user.id}`);
  if (rl) return rl;

  const { searchParams } = new URL(req.url);
  const parsed = QuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid query" }, { status: 400 });
  }

  let recipientUserId = parsed.data.userId;
  if (!recipientUserId && parsed.data.email) {
    const { data: prof } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", parsed.data.email)
      .maybeSingle();
    if (!prof) return NextResponse.json({ error: "recipient not registered" }, { status: 404 });
    recipientUserId = prof.id;
  }

  const { data: client } = await admin
    .from("clients")
    .select("pubkey_x25519, enc_version")
    .eq("profile_id", recipientUserId!)
    .maybeSingle();

  if (!client?.pubkey_x25519) {
    return NextResponse.json({ error: "recipient has no E2EE setup" }, { status: 404 });
  }

  await logAudit(admin, {
    actor_id: profile.id,
    action: "crypto.pubkey.lookup",
    meta: { recipient_user_id: recipientUserId },
  });

  return NextResponse.json({
    userId: recipientUserId,
    pubX25519: b64encode(byteaToBytes(client.pubkey_x25519)),
    encVersion: client.enc_version ?? 1,
  });
}
