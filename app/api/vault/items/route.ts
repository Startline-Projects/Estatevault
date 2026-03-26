import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: client } = await admin.from("clients").select("id").eq("profile_id", user.id).single();
  if (!client) return NextResponse.json({ items: [] });

  const { data: items } = await admin.from("vault_items").select("*").eq("client_id", client.id).order("created_at", { ascending: false });
  return NextResponse.json({ items: items || [] });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const admin = createAdminClient();
  const { data: client } = await admin.from("clients").select("id").eq("profile_id", user.id).single();
  if (!client) return NextResponse.json({ error: "No client record" }, { status: 400 });

  const { data: item, error } = await admin.from("vault_items").insert({
    client_id: client.id,
    category: body.category,
    label: body.label,
    data: body.data || {},
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("audit_log").insert({ actor_id: user.id, action: "vault.item_added", resource_type: "vault_item", resource_id: item.id, metadata: { category: body.category } });

  return NextResponse.json({ item });
}

export async function DELETE(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("id");
  if (!itemId) return NextResponse.json({ error: "Missing item id" }, { status: 400 });

  const admin = createAdminClient();
  const { data: client } = await admin.from("clients").select("id").eq("profile_id", user.id).single();
  if (!client) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check ownership and if auto-generated
  const { data: item } = await admin.from("vault_items").select("client_id, data").eq("id", itemId).single();
  if (!item || item.client_id !== client.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const itemData = item.data as Record<string, unknown>;
  if (itemData?.order_id) return NextResponse.json({ error: "Auto-generated items cannot be deleted" }, { status: 403 });

  await admin.from("vault_items").delete().eq("id", itemId);
  await admin.from("audit_log").insert({ actor_id: user.id, action: "vault.item_deleted", resource_type: "vault_item", resource_id: itemId });

  return NextResponse.json({ success: true });
}
