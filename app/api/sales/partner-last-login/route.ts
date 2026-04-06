import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";

export const dynamic = "force-dynamic";

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const partnerId = searchParams.get("partnerId");
  if (!partnerId) return NextResponse.json({ error: "Missing partnerId" }, { status: 400 });

  const admin = createAdminClient();

  // Get partner's profile_id
  const { data: partner } = await admin
    .from("partners")
    .select("profile_id")
    .eq("id", partnerId)
    .single();

  if (!partner?.profile_id) return NextResponse.json({ last_login: null });

  // Get last_sign_in_at from auth.users
  const { data: { user: authUser } } = await admin.auth.admin.getUserById(partner.profile_id);

  return NextResponse.json({
    last_login: authUser?.last_sign_in_at ?? null,
  });
}
