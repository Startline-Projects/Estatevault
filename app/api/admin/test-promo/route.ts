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

// GET, check if test code is active (public, used by checkout APIs)
export async function GET() {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", "test_promo_code")
      .single();

    if (error) {
      console.error("app_settings read error:", error.message);
      return NextResponse.json({ active: false });
    }

    const active = (data?.value as { active?: boolean })?.active ?? false;
    return NextResponse.json({ active });
  } catch (err) {
    console.error("test-promo GET error:", err);
    return NextResponse.json({ active: false });
  }
}

// POST, toggle test code (admin only)
export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("user_type")
      .eq("id", user.id)
      .single();

    if (!profile || profile.user_type !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { active } = await request.json();

    await admin.from("app_settings").upsert({
      key: "test_promo_code",
      value: { active: !!active },
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    });

    await admin.from("audit_log").insert({
      actor_id: user.id,
      action: active ? "test_promo.activated" : "test_promo.deactivated",
      resource_type: "app_settings",
      metadata: { active: !!active },
    });

    return NextResponse.json({ success: true, active: !!active });
  } catch (error) {
    console.error("Test promo toggle error:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
