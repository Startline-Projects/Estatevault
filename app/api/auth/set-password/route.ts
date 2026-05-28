export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { authSetPasswordSchema } from "@/lib/validation/schemas";
import { consumeVerifiedToken } from "@/lib/auth/emailVerification";
import { authRateLimit } from "@/lib/rate-limit";
import * as auditLogRepo from "@/lib/repos/server/auditLogRepo";

export const POST = withRoute(async (req: NextRequest) => {
  const body = await req.json();
  const parsed = authSetPasswordSchema.safeParse(body);
  if (!parsed.success) return fail("invalid payload", 400);
  const { email, password, fullName, verifiedToken } = parsed.data;
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!normalizedEmail || !password) return fail("Missing required fields", 400);
  if (password.length < 8) return fail("Password must be at least 8 characters", 400);

  const { success } = await authRateLimit.limit(normalizedEmail);
  if (!success) return fail("Too many attempts. Please wait and try again.", 429);

  if (!verifiedToken || !consumeVerifiedToken(normalizedEmail, verifiedToken)) {
    return fail("Please verify your email first.", 403);
  }

  const admin = createAdminClient();

  let resolvedUserId = "";

  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: profile } = await admin
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

  if (!resolvedUserId) {
    const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { user_type: "client", full_name: fullName?.trim() || "" },
    });
    if (createErr || !newUser.user) {
      console.error("Failed to create auth user in set-password:", createErr?.message);
      return fail("Unable to create account. Please contact support.", 500);
    }
    resolvedUserId = newUser.user.id;
    await admin.from("profiles").upsert({
      id: resolvedUserId,
      email: normalizedEmail,
      full_name: fullName?.trim() || null,
      user_type: "client",
    });

    const { data: recentOrder } = await admin
      .from("orders")
      .select("client_id")
      .order("created_at", { ascending: false })
      .limit(10);

    if (recentOrder) {
      for (const o of recentOrder) {
        if (!o.client_id) continue;
        const { data: clientRow } = await admin
          .from("clients")
          .select("id, profile_id")
          .eq("id", o.client_id)
          .is("profile_id", null)
          .single();
        if (clientRow) {
          await admin.from("clients").update({ profile_id: resolvedUserId }).eq("id", clientRow.id);
          break;
        }
      }
    }

    await auditLogRepo.insertEntry(admin, {
      actor_id: resolvedUserId,
      action: "account.created_at_password_set",
      resource_type: "profile",
      resource_id: resolvedUserId,
    });

    return ok({ success: true });
  }

  const { data: authUserData, error: getUserErr } = await admin.auth.admin.getUserById(resolvedUserId);
  if (getUserErr || !authUserData?.user) return fail("User not found", 404);
  if (authUserData.user.email?.toLowerCase() !== normalizedEmail) return fail("Email mismatch", 403);

  const { error: updateErr } = await admin.auth.admin.updateUserById(resolvedUserId, { password });
  if (updateErr) return fail("Failed to set password", 500);

  if (fullName && typeof fullName === "string" && fullName.trim()) {
    await admin.from("profiles").update({ full_name: fullName.trim() }).eq("id", resolvedUserId);
  }

  await auditLogRepo.insertEntry(admin, {
    actor_id: resolvedUserId,
    action: "account.password_set",
    resource_type: "profile",
    resource_id: resolvedUserId,
  });

  return ok({ success: true });
});
