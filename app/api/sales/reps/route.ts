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
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Admin only
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("user_type")
    .eq("id", user.id)
    .single();

  if (!profile || profile.user_type !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  // Fetch all sales reps
  const { data: reps, error: repsErr } = await admin
    .from("profiles")
    .select("id, full_name, email, created_at, commission_rate")
    .eq("user_type", "sales_rep")
    .order("created_at", { ascending: false });

  if (repsErr) {
    return NextResponse.json({ error: "Failed to fetch reps" }, { status: 500 });
  }

  // Count active partners for each rep
  const repsWithCounts = await Promise.all(
    (reps || []).map(async (rep) => {
      const { count } = await admin
        .from("partners")
        .select("id", { count: "exact", head: true })
        .eq("created_by", rep.id)
        .eq("status", "active");

      return {
        id: rep.id,
        full_name: rep.full_name || "Unknown",
        email: rep.email,
        active_partners: count || 0,
        created_at: rep.created_at,
        commission_rate: rep.commission_rate ?? 0.05,
      };
    })
  );

  return NextResponse.json({ reps: repsWithCounts });
}

export async function PATCH(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("user_type").eq("id", user.id).single();
  if (!profile || profile.user_type !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { repId, commissionRate } = await request.json();
  if (!repId || commissionRate === undefined) {
    return NextResponse.json({ error: "Missing repId or commissionRate" }, { status: 400 });
  }

  const parsed = parseFloat(commissionRate);
  if (isNaN(parsed) || parsed < 0 || parsed > 100) {
    return NextResponse.json({ error: "Commission rate must be between 0 and 100" }, { status: 400 });
  }

  await admin.from("profiles").update({ commission_rate: parsed / 100 }).eq("id", repId).eq("user_type", "sales_rep");
  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "sales_rep.commission_updated",
    resource_type: "profile",
    resource_id: repId,
    metadata: { commission_rate: parsed / 100 },
  });

  return NextResponse.json({ success: true });
}
