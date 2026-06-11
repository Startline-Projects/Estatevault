import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { createReviewAttorneySchema } from "@/lib/validation/schemas";
import { getAppUrl } from "@/lib/config/appUrl";
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
  let profileId: string;

  if (existingProfile) {
    // BUG-18 guard: never overwrite a profile the partner doesn't own.
    // Attach only when the email is unclaimed (no role yet) or is already a
    // review_attorney managed by this same partner.
    const isUnclaimed = !existingProfile.user_type;
    const isOwnAttorney =
      existingProfile.user_type === "review_attorney" &&
      existingProfile.managed_by_admin === partner.profile_id;
    if (!isUnclaimed && !isOwnAttorney) {
      return fail("That email is already associated with another EstateVault account.", 409);
    }
    profileId = existingProfile.id;
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
  } else if (authMatch?.id) {
    // Auth user exists without a profile row — unclaimed; create the profile.
    profileId = authMatch.id;
    await profileRepo.upsert(auth.admin, {
      id: profileId,
      email: normalizedEmail,
      full_name: attorneyName || null,
      user_type: "review_attorney",
      bar_number: barNumber || null,
      is_payroll: false,
      managed_by_admin: partner.profile_id,
    });
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
        redirectTo: `${getAppUrl()}/attorney`,
      },
    });
  }

  return ok({ profileId });
});
