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
  if (entry.count >= 5) return false;
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
    if (!checkRateLimit(email)) {
      return NextResponse.json({ error: "Too many attempts. Please wait a minute and try again." }, { status: 429 });
    }

    const supabase = createAdminClient();

    // Step 1: resolve userId, try provided ID first, then look up by email
    let resolvedUserId: string = userId || "";

    if (!resolvedUserId) {
      // Webhook may still be processing, retry up to 4x with 2s gaps (8s total)
      for (let attempt = 0; attempt < 4; attempt++) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", email)
          .single();
        if (profile) {
          resolvedUserId = profile.id;
          break;
        }
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    }

    // Step 2: if profile still not found, check if auth user exists without a profile
    if (!resolvedUserId) {
      const { data: authUsers } = await supabase.auth.admin.listUsers();
      const existingAuthUser = authUsers?.users?.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase()
      );
      if (existingAuthUser) {
        resolvedUserId = existingAuthUser.id;
        // Create the missing profile
        await supabase.from("profiles").upsert({
          id: resolvedUserId,
          email,
          full_name: fullName?.trim() || null,
          user_type: "client",
        });
      }
    }

    // Step 3: if still not found, create the auth user + profile from scratch
    // This handles the case where the Stripe webhook completely failed
    if (!resolvedUserId) {
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email,
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
        email,
        full_name: fullName?.trim() || null,
        user_type: "client",
      });

      // Also link to the client record for this order (look up by email via orders/clients)
      // Find the most recent order whose client has no profile_id and matches this email
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

      // Password already set during createUser, just sign audit and return
      await supabase.from("audit_log").insert({
        actor_id: resolvedUserId,
        action: "account.created_at_password_set",
        resource_type: "profile",
        resource_id: resolvedUserId,
      });

      return NextResponse.json({ success: true });
    }

    // Step 4: user exists, set their password
    const { data: authUserData, error: getUserErr } = await supabase.auth.admin.getUserById(resolvedUserId);
    if (getUserErr || !authUserData?.user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (authUserData.user.email?.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: "Email mismatch" }, { status: 403 });
    }

    const { error: updateErr } = await supabase.auth.admin.updateUserById(resolvedUserId, { password });
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Save full_name to profile
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
