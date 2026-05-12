import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/api/auth";
import { apiRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const Schema = z.object({
  table: z.enum(["vault_items", "vault_trustees", "farewell_messages"]),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await apiRateLimit.limit(`backfill-fetch:${user.id}`);
  if (!rl.success) return NextResponse.json({ error: "rate limited" }, { status: 429 });

  const url = new URL(req.url);
  const parsed = Schema.safeParse({
    table: url.searchParams.get("table"),
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: "invalid query" }, { status: 400 });

  const admin = createAdminClient();
  const { data: client } = await admin.from("clients").select("id").eq("profile_id", user.id).single();
  if (!client) return NextResponse.json({ rows: [] });

  let rows: unknown[] = [];
  switch (parsed.data.table) {
    case "vault_items": {
      const { data } = await admin
        .from("vault_items")
        .select("id, category, label, data")
        .eq("client_id", client.id)
        .is("ciphertext", null)
        .not("label", "is", null)
        .order("created_at", { ascending: true })
        .limit(parsed.data.limit);
      rows = data ?? [];
      break;
    }
    case "vault_trustees": {
      const { data } = await admin
        .from("vault_trustees")
        .select("id, trustee_name, trustee_email, trustee_relationship")
        .eq("client_id", client.id)
        .is("ciphertext", null)
        .neq("trustee_email", "")
        .order("created_at", { ascending: true })
        .limit(parsed.data.limit);
      rows = data ?? [];
      break;
    }
    case "farewell_messages": {
      const { data } = await admin
        .from("farewell_messages")
        .select("id, title, recipient_email")
        .eq("client_id", client.id)
        .is("ciphertext", null)
        .neq("title", "")
        .order("created_at", { ascending: true })
        .limit(parsed.data.limit);
      rows = data ?? [];
      break;
    }
  }

  return NextResponse.json({ rows });
}
