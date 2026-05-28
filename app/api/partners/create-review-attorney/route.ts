import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { createReviewAttorneySchema } from "@/lib/validation/schemas";
import * as profileRepo from "@/lib/repos/server/profileRepo";

export const POST = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["partner"]);
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const parsed = createReviewAttorneySchema.safeParse(body);
  if (!parsed.success) return fail("invalid payload", 400);
  const { partnerId, attorneyName, attorneyEmail, barNumber } = parsed.data;

  const { data: partner } = await auth.admin
    .from("partners")
    .select("id, profile_id")
    .eq("id", partnerId)
    .single();
  if (!partner) return fail("Partner not found", 404);
  if (partner.profile_id !== auth.profile.id) return fail("Not authorized", 403);

  const normalizedEmail = attorneyEmail.toLowerCase();
  const { data: existingProfile } = await profileRepo.findByEmail(auth.admin, normalizedEmail);
  const { data: authMatch } = !existingProfile
    ? await auth.admin.rpc("find_auth_user_by_email", { lookup_email: normalizedEmail }).returns<{ id: string; email: string }[]>().maybeSingle()
    : { data: null };
  const existingUserId = existingProfile?.id || authMatch?.id;

  let profileId: string;

  if (existingUserId) {
    profileId = existingUserId;
    await auth.admin
      .from("profiles")
      .update({
        full_name: attorneyName || null,
        user_type: "review_attorney",
        bar_number: barNumber || null,
        is_payroll: false,
        managed_by_admin: partner.profile_id,
      })
      .eq("id", profileId);
  } else {
    const { data: newUser, error: authError } = await auth.admin.auth.admin.createUser({
      email: normalizedEmail,
      email_confirm: true,
      user_metadata: { full_name: attorneyName || "" },
    });
    if (authError || !newUser?.user) return fail("Failed to create attorney account", 500);

    profileId = newUser.user.id;

    await profileRepo.upsert(auth.admin, {
      id: profileId,
      email: normalizedEmail,
      full_name: attorneyName || null,
      user_type: "review_attorney",
      bar_number: barNumber || null,
      is_payroll: false,
      managed_by_admin: partner.profile_id,
    });

    await auth.admin.auth.admin.generateLink({
      type: "magiclink",
      email: normalizedEmail,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL || "https://estatevault.us"}/attorney`,
      },
    });
  }

  return ok({ profileId });
});
