export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

// Rate limit: 5 attempts per email per 60 seconds
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(email: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(email);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(email, { count: 1, resetAt: now + 60_000 });
    return true;
  }

  if (entry.count >= 5) {
    return false;
  }

  entry.count++;
  return true;
}

export async function POST(request: Request) {
  try {
    const { userId, email, password, fullName } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    // Rate limit per email
    if (!checkRateLimit(email)) {
      return NextResponse.json(
        { error: "Too many attempts. Please wait a minute and try again." },
        { status: 429 }
      );
    }

    const supabase = createAdminClient();

    // Resolve the user ID — either provided directly or looked up by email
    let resolvedUserId = userId;

    if (!resolvedUserId) {
      // Webhook may not have created the user yet — retry up to 3 times
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", email)
          .single();

        if (profile) {
          resolvedUserId = profile.id;
          break;
        }

        // Wait 2 seconds before retrying (webhook may still be processing)
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    }

    if (!resolvedUserId) {
      return NextResponse.json(
        { error: "Account not ready yet. Please wait a moment and try again." },
        { status: 404 }
      );
    }

    // Verify the user exists in auth
    const { data: user, error: getUserErr } = await supabase.auth.admin.getUserById(resolvedUserId);
    if (getUserErr || !user?.user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify email matches (case-insensitive)
    if (user.user.email?.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: "Email mismatch" }, { status: 403 });
    }

    // Update password
    const { error: updateErr } = await supabase.auth.admin.updateUserById(resolvedUserId, {
      password,
    });

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Save full_name to profile if provided
    if (fullName && typeof fullName === "string" && fullName.trim()) {
      await supabase
        .from("profiles")
        .update({ full_name: fullName.trim() })
        .eq("id", resolvedUserId);
    }

    // Audit log
    const { error: auditErr } = await supabase.from("audit_log").insert({
      actor_id: resolvedUserId,
      action: "account.password_set",
      resource_type: "profile",
      resource_id: resolvedUserId,
    });
    if (auditErr) {
      console.error("Audit log insert failed:", auditErr);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Set password error:", error);
    return NextResponse.json({ error: "Failed to set password" }, { status: 500 });
  }
}
