import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/api/auth";
import { apiRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const Schema = z.object({
  bucket: z.enum(["documents", "farewell-videos"]).default("documents"),
  path: z.string().min(1),
});

const TTL_S = 60 * 5;

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await apiRateLimit.limit(`download-url:${user.id}`);
  if (!rl.success) return NextResponse.json({ error: "rate limited" }, { status: 429 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid payload" }, { status: 400 });

  const admin = createAdminClient();
  const { data: client } = await admin
    .from("clients")
    .select("id")
    .eq("profile_id", user.id)
    .single();
  if (!client) return NextResponse.json({ error: "No client record" }, { status: 400 });

  // Path scoping: must start with vault/<client.id>/. Prevents enumeration.
  const expectedPrefix = `vault/${client.id}/`;
  if (!parsed.data.path.startsWith(expectedPrefix)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // For farewell-videos, additional ownership check via farewell_messages.
  if (parsed.data.bucket === "farewell-videos") {
    const { data: msg } = await admin
      .from("farewell_messages")
      .select("client_id")
      .eq("storage_path", parsed.data.path)
      .maybeSingle();
    if (!msg || msg.client_id !== client.id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const { data, error } = await admin.storage
    .from(parsed.data.bucket)
    .createSignedUrl(parsed.data.path, TTL_S);

  if (error || !data) {
    return NextResponse.json({ error: "failed to mint signed url" }, { status: 500 });
  }

  return NextResponse.json({
    signedUrl: data.signedUrl,
    expiresInSec: TTL_S,
  });
}
