export const dynamic = "force-dynamic";

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

const ALLOWED_STATUSES = ["active", "suspended"];

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("user_type")
      .eq("id", user.id)
      .single();
    if (profile?.user_type !== "admin")
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );

    const { status } = await request.json();
    if (!ALLOWED_STATUSES.includes(status))
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 }
      );

    const { data: affiliate } = await admin
      .from("affiliates")
      .select("id, status")
      .eq("id", params.id)
      .single();
    if (!affiliate)
      return NextResponse.json(
        { error: "Affiliate not found" },
        { status: 404 }
      );

    await admin
      .from("affiliates")
      .update({ status })
      .eq("id", params.id);

    try {
      await admin.from("audit_log").insert({
        actor_id: user.id,
        action: "affiliate.status_changed",
        resource_type: "affiliate",
        resource_id: params.id,
        metadata: { from: affiliate.status, to: status },
      });
    } catch {
      // audit log is best-effort
    }

    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error("Affiliate status update error:", error);
    return NextResponse.json(
      { error: "Failed to update status" },
      { status: 500 }
    );
  }
}
