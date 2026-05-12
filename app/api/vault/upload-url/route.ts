import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/api/auth";
import { apiRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Mint a signed upload URL for the documents bucket. Client uploads opaque
// ciphertext (.bin). Server enforces only path scoping + size cap (set by
// signed URL options); content type is opaque.
const Schema = z.object({
  kind: z.enum(["document", "farewell"]).default("document"),
  // Optional client-supplied UUID to allow PUT before DB row exists.
  uploadId: z.string().uuid().optional(),
  expectedSize: z.number().int().positive().optional(),
});

const SIZE_LIMITS = {
  document: 20 * 1024 * 1024,        // 20 MB
  farewell: 500 * 1024 * 1024,       // 500 MB
};

const BUCKETS = {
  document: "documents",
  farewell: "farewell-videos",
};

const SIGNED_URL_TTL_S = 60 * 5; // 5 min

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const admin = createAdminClient();
  const { data: client } = await admin
    .from("clients")
    .select("id, vault_subscription_status")
    .eq("profile_id", user.id)
    .single();
  if (!client) return NextResponse.json({ error: "No client record" }, { status: 400 });
  if (client.vault_subscription_status !== "active") {
    return NextResponse.json({ error: "Vault subscription required" }, { status: 403 });
  }

  const uploadId = parsed.data.uploadId ?? randomUUID();
  const path = `vault/${client.id}/${uploadId}.bin`;
  const bucket = BUCKETS[kind];

  const { data, error } = await admin.storage
    .from(bucket)
    .createSignedUploadUrl(path);

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
