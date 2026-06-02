import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { authSignupSchema } from "@/lib/validation/schemas";
import { consumeVerifiedToken } from "@/lib/auth/emailVerification";
import { sendWelcomeEmail } from "@/lib/email";

export const POST = withRoute(async (req: NextRequest) => {
  const body = await req.json();
  const parsed = authSignupSchema.safeParse(body);
  if (!parsed.success) return fail("invalid payload", 400);
  const { email, password, fullName, verifiedToken, partnerSlug } = parsed.data;
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!normalizedEmail || !password) return fail("Email and password are required.", 400);
  if (password.length < 8) return fail("Password must be at least 8 characters.", 400);
  if (!verifiedToken || !(await consumeVerifiedToken(normalizedEmail, verifiedToken))) {
    return fail("Please verify your email first.", 403);
  }

  const admin = createAdminClient();

  const { data: existingProfile, error: existingProfileErr } = await admin
    .from("profiles")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (existingProfileErr) return fail("Unable to validate existing account.", 500);
  if (existingProfile) return fail("An account with this email already exists. Please sign in.", 409);

  const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name: (fullName || "").trim(), user_type: "client" },
  });

  if (createErr || !newUser.user) return fail(createErr?.message || "Failed to create account.", 500);

  const { error: upsertErr } = await admin.from("profiles").upsert({
    id: newUser.user.id,
    email: normalizedEmail,
    full_name: (fullName || "").trim() || null,
    user_type: "client",
  });

  if (upsertErr) return fail("Failed to finalize profile setup.", 500);

  let resolvedPartnerId: string | null = null;
  if (partnerSlug) {
    const { data: partner } = await admin
      .from("partners")
      .select("id")
      .eq("partner_slug", partnerSlug)
      .maybeSingle();
    resolvedPartnerId = partner?.id || null;
  }

  try {
    const { origin } = new URL(req.url);
    await sendWelcomeEmail({
      to: normalizedEmail,
      fullName: (fullName || "").trim() || null,
      loginLink: `${origin}/auth/login?email=${encodeURIComponent(normalizedEmail)}`,
      partnerId: resolvedPartnerId,
    });
  } catch (mailErr) {
    console.error("welcome email failed:", mailErr);
  }

  return ok({ success: true, userId: newUser.user.id });
});
