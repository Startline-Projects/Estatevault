import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { requireClientUser } from "@/lib/api/crypto";
import { apiRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Mint a signed upload URL. Client PUTs opaque ciphertext (.bin) — encryption is
// client-side with the per-user FILES key (Option A / F2). Server only scopes the
// path + size; content is opaque.
const Schema = z.object({
  kind: z.enum(["document", "farewell"]).default("document"),
  uploadId: z.string().uuid().optional(),
  expectedSize: z.number().int().positive().optional(),
});

const SIZE_LIMITS = {
  document: 20 * 1024 * 1024,
  farewell: 500 * 1024 * 1024,
};
const BUCKETS = { document: "documents", farewell: "farewell-videos" };
const SIGNED_URL_TTL_S = 60 * 5;

export async function POST(req: NextRequest) {
  const ctx = await requireClientUser(req);
  if ("error" in ctx) return ctx.error;
  const { admin, user, client } = ctx;

  const rl = await apiRateLimit.limit(`upload-url:${user.id}`);
  if (!rl.success) return NextResponse.json({ error: "rate limited" }, { status: 429 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid payload" }, { status: 400 });

  const { kind } = parsed.data;
  if (parsed.data.expectedSize && parsed.data.expectedSize > SIZE_LIMITS[kind]) {
    return NextResponse.json({ error: "file too large" }, { status: 413 });
  }

  const { data: sub } = await admin
    .from("clients").select("vault_subscription_status").eq("id", client.id).single();
  if (sub?.vault_subscription_status !== "active") {
    return NextResponse.json({ error: "Vault subscription required" }, { status: 403 });
  }

  const uploadId = parsed.data.uploadId ?? randomUUID();
  const path = `vault/${client.id}/${uploadId}.bin`;
  const bucket = BUCKETS[kind];

  const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) {
    return NextResponse.json({ error: "failed to mint signed url" }, { status: 500 });
  }

  return NextResponse.json({
    bucket,
    path,
    token: data.token,
    signedUrl: data.signedUrl,
    expiresInSec: SIGNED_URL_TTL_S,
    sizeLimit: SIZE_LIMITS[kind],
  });
}
