import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";

function createAdminClient() {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { cookies: { getAll: () => [], setAll: () => {} } });
}

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: client } = await admin.from("clients").select("id").eq("profile_id", user.id).single();
  if (!client) return NextResponse.json({ trustees: [] });

  const { data } = await admin.from("vault_trustees").select("*").eq("client_id", client.id);
  return NextResponse.json({ trustees: data || [] });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const admin = createAdminClient();
  const { data: client } = await admin.from("clients").select("id").eq("profile_id", user.id).single();
  if (!client) return NextResponse.json({ error: "No client record" }, { status: 400 });

  // Check max 2
  const { data: existing } = await admin.from("vault_trustees").select("id").eq("client_id", client.id);
  if (existing && existing.length >= 2) return NextResponse.json({ error: "Maximum 2 trustees allowed" }, { status: 400 });

  const { error } = await admin.from("vault_trustees").insert({ client_id: client.id, ...body });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const admin = createAdminClient();
  const { data: client } = await admin.from("clients").select("id").eq("profile_id", user.id).single();
  if (!client) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await admin.from("vault_trustees").delete().eq("id", id).eq("client_id", client.id);
  return NextResponse.json({ success: true });
}
