import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/api/auth";

export async function POST() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();

  const { data: client } = await admin
    .from("clients")
    .select("id")
    .eq("profile_id", user.id)
    .single();

  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  await admin
    .from("clients")
    .update({ documents_executed: true, documents_executed_at: new Date().toISOString() })
    .eq("id", client.id);

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "client.documents_executed",
    resource_type: "client",
    resource_id: client.id,
  });

  return NextResponse.json({ success: true });
}
