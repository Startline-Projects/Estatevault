import { NextRequest, NextResponse } from "next/server";
import { requireClientUser } from "@/lib/api/crypto";
import { getOrCreateUserDek } from "@/lib/api/dek";
import { deriveSubKey, INFO, zero } from "@/lib/crypto/keyManager";
import { apiRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Option A (F2): hand the authenticated client its per-user FILES sub-key so it
// can stream-encrypt/decrypt file content locally (large videos can't be routed
// through a serverless function). The server can derive the same key from the
// user's DEK, so files stay recoverable (server-managed model).
export async function GET(req: NextRequest) {
  const ctx = await requireClientUser(req, { autoCreate: true });
  if ("error" in ctx) return ctx.error;
  const { admin, user, client } = ctx;

  const rl = await apiRateLimit.limit(`file-key:${user.id}`);
  if (!rl.success) return NextResponse.json({ error: "rate limited" }, { status: 429 });

  const dek = await getOrCreateUserDek(admin, client);
  let keyB64: string;
  try {
    const fileKey = await deriveSubKey(dek, INFO.FILES);
    keyB64 = Buffer.from(fileKey).toString("base64");
    zero(fileKey);
  } finally {
    zero(dek);
  }

  return NextResponse.json({ key: keyB64, info: INFO.FILES });
}
