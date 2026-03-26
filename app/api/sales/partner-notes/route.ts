import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";

function createAdminClient() {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { cookies: { getAll: () => [], setAll: () => {} } });
}

export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const partnerId = searchParams.get("partnerId");
  if (!partnerId) return NextResponse.json({ notes: [] });

  const admin = createAdminClient();
  const { data } = await admin.from("sales_partner_notes").select("*").eq("partner_id", partnerId).order("created_at", { ascending: false });
  return NextResponse.json({ notes: data || [] });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { partnerId, note } = await request.json();
  if (!partnerId || !note) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const admin = createAdminClient();
  await admin.from("sales_partner_notes").insert({ partner_id: partnerId, sales_rep_id: user.id, note });
  return NextResponse.json({ success: true });
}
