import Stripe from "stripe";
import { getAppUrl } from "@/lib/config/appUrl";
import { sendWelcomeEmail } from "@/lib/email";
import * as clientRepo from "@/lib/repos/server/clientRepo";
import * as profileRepo from "@/lib/repos/server/profileRepo";
import * as auditLogRepo from "@/lib/repos/server/auditLogRepo";
import type { Admin } from "./types";

// Resolve the client for a guest checkout (no client_id in metadata): find the
// profile by email, link an existing auth user, or auto-create the account +
// welcome email, then find-or-create the client row. Returns the client id.
export async function resolveOrCreateGuestClient(
  supabase: Admin,
  session: Stripe.Checkout.Session,
  metadata: Record<string, string>,
  partnerId: string | null,
  productType: "vault" | "will" | "trust",
): Promise<string | null> {
  const guestEmail = metadata.guest_email || session.customer_details?.email;
  const guestName = metadata.guest_name || session.customer_details?.name || "";

  if (!guestEmail) return null;

  let profileId: string | null = null;
  const { data: existingProfile } = await profileRepo.findIdByEmailMaybe(supabase, guestEmail);

  if (existingProfile) {
    profileId = existingProfile.id;
  } else {
    const { data: authMatch } = await supabase
      .rpc("find_auth_user_by_email", { lookup_email: guestEmail })
      .returns<{ id: string; email: string }[]>()
      .maybeSingle();

    if (authMatch) {
      profileId = authMatch.id;
      await profileRepo.upsert(supabase, {
        id: profileId,
        email: guestEmail,
        full_name: guestName,
        user_type: "client",
      });
    } else {
      const { data: newUser } = await supabase.auth.admin.createUser({
        email: guestEmail,
        email_confirm: true,
        user_metadata: { user_type: "client", full_name: guestName },
      });
      if (newUser?.user) {
        profileId = newUser.user.id;
        await profileRepo.upsert(supabase, {
          id: profileId,
          email: guestEmail,
          full_name: guestName,
          user_type: "client",
        });

        const originUrl = getAppUrl();
        await sendWelcomeEmail({
          to: guestEmail,
          fullName: guestName || null,
          productType,
          loginLink: `${originUrl}/auth/login?email=${encodeURIComponent(guestEmail)}`,
          partnerId,
        });
        await auditLogRepo.insertEntry(supabase, {
          action: "email.welcome_sent",
          resource_type: "profile",
          resource_id: profileId,
        });
      }
    }
  }

  if (!profileId) return null;

  const { data: existingClient } = await clientRepo.findByProfileId(supabase, profileId)
    .then(r => r, () => ({ data: null }));

  if (existingClient) return existingClient.id;

  const { data: newClient } = await clientRepo.create(supabase, {
    profile_id: profileId,
    partner_id: partnerId,
    source: partnerId ? "partner" : "direct",
  });
  return newClient?.id ?? null;
}
