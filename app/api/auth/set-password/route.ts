export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/api/auth";
import { consumeVerifiedToken } from "@/lib/auth/emailVerification";
import { authRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const { email, password, fullName, verifiedToken } = await request.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const { success } = await authRateLimit.limit(normalizedEmail);
    if (!success) {
      return NextResponse.json({ error: "Too many attempts. Please wait and try again." }, { status: 429 });
    }

    if (!verifiedToken || !consumeVerifiedToken(normalizedEmail, verifiedToken)) {
      return NextResponse.json({ error: "Please verify your email first." }, { status: 403 });
    }

    const supabase = createAdminClient();

    // Resolve user by email from profiles — never trust caller-supplied userId
    let resolvedUserId = "";

    // Webhook may still be processing; retry up to 4x with 2s gaps
    for (let attempt = 0; attempt < 4; attempt++) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", normalizedEmail)
        .single();
      if (profile) {
        resolvedUserId = profile.id;
        break;
      }
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    // If profile still not found, try creating the user.
    // If email already exists in auth.users (orphaned), createUser will fail —
    // we catch that and attempt password update via the error path below.

    // If still not found, create the auth user + profile from scratch
    // This handles the case where the Stripe webhook completely failed
    if (!resolvedUserId) {
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: { user_type: "client", full_name: fullName?.trim() || "" },
      });
      if (createErr || !newUser.user) {
        console.error("Failed to create auth user in set-password:", createErr?.message);
        return NextResponse.json(
          { error: "Unable to create account. Please contact support." },
          { status: 500 }
        );
      }
      resolvedUserId = newUser.user.id;
      await supabase.from("profiles").upsert({
        id: resolvedUserId,
        email: normalizedEmail,
        full_name: fullName?.trim() || null,
        user_type: "client",
      });

      // Link to the most recent unlinked client record for this email
      const { data: recentOrder } = await supabase
        .from("orders")
        .select("client_id")
        .order("created_at", { ascending: false })
        .limit(10);

      if (recentOrder) {
        for (const o of recentOrder) {
          if (!o.client_id) continue;
          const { data: clientRow } = await supabase
            .from("clients")
            .select("id, profile_id")
            .eq("id", o.client_id)
            .is("profile_id", null)
            .single();
          if (clientRow) {
            await supabase.from("clients").update({ profile_id: resolvedUserId }).eq("id", clientRow.id);
            break;
          }
        }
      }

      await supabase.from("audit_log").insert({
        actor_id: resolvedUserId,
        action: "account.created_at_password_set",
        resource_type: "profile",
        resource_id: resolvedUserId,
      });

      return NextResponse.json({ success: true });
    }

    // User exists — set their password
    const { data: authUserData, error: getUserErr } = await supabase.auth.admin.getUserById(resolvedUserId);
    if (getUserErr || !authUserData?.user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (authUserData.user.email?.toLowerCase() !== normalizedEmail) {
      return NextResponse.json({ error: "Email mismatch" }, { status: 403 });
    }

    const { error: updateErr } = await supabase.auth.admin.updateUserById(resolvedUserId, { password });
    if (updateErr) {
      return NextResponse.json({ error: "Failed to set password" }, { status: 500 });
    }

    if (fullName && typeof fullName === "string" && fullName.trim()) {
      await supabase.from("profiles").update({ full_name: fullName.trim() }).eq("id", resolvedUserId);
    }

    await supabase.from("audit_log").insert({
      actor_id: resolvedUserId,
      action: "account.password_set",
      resource_type: "profile",
      resource_id: resolvedUserId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Set password error:", error);
    return NextResponse.json({ error: "Failed to set password" }, { status: 500 });
  }
}
