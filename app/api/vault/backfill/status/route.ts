import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/api/auth";

export const runtime = "nodejs";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: client } = await admin
    .from("clients")
    .select("id, crypto_setup_at, crypto_backfill_complete_at")
    .eq("profile_id", user.id)
    .single();
  if (!client) return NextResponse.json({ error: "no client" }, { status: 404 });

  const counts = await Promise.all([
    admin.from("vault_items")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client.id)
      .is("ciphertext", null)
      .not("label", "is", null),
    admin.from("vault_trustees")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client.id)
      .is("ciphertext", null)
      .neq("trustee_email", ""),
    admin.from("farewell_messages")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client.id)
      .is("ciphertext", null)
      .neq("title", ""),
  ]);

  const remaining = {
    vault_items: counts[0].count ?? 0,
    vault_trustees: counts[1].count ?? 0,
    farewell_messages: counts[2].count ?? 0,
  };
  const totalRemaining = remaining.vault_items + remaining.vault_trustees + remaining.farewell_messages;
  const complete = totalRemaining === 0;

  // Auto-mark client complete the first time we observe zero remaining.
  if (complete && client.crypto_setup_at && !client.crypto_backfill_complete_at) {
    await admin
      .from("clients")
      .update({ crypto_backfill_complete_at: new Date().toISOString() })
      .eq("id", client.id);
  }

  return NextResponse.json({
    bootstrapped: !!client.crypto_setup_at,
    completedAt: client.crypto_backfill_complete_at,
    complete,
    remaining,
    totalRemaining,
  });
}
