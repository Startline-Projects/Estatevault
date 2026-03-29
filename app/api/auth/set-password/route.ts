import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

export async function POST(request: Request) {
  try {
    const { userId, email, password } = await request.json();

    if (!userId || !email || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Verify the user exists
    const { data: user, error: getUserErr } = await supabase.auth.admin.getUserById(userId);
    if (getUserErr || !user?.user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify email matches
    if (user.user.email !== email) {
      return NextResponse.json({ error: "Email mismatch" }, { status: 403 });
    }

    // Update password
    const { error: updateErr } = await supabase.auth.admin.updateUserById(userId, {
      password,
    });

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Audit log
    await supabase.from("audit_log").insert({
      actor_id: userId,
      action: "account.password_set",
      resource_type: "profile",
      resource_id: userId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Set password error:", error);
    return NextResponse.json({ error: "Failed to set password" }, { status: 500 });
  }
}
