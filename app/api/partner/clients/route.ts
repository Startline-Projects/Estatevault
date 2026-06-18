import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { ok, fail } from "@/lib/api/response";
import { partnerClientsCreateSchema, partnerClientsUpdateSchema } from "@/lib/validation/schemas";
import { withRoute } from "@/lib/api/route";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";
import * as clientRepo from "@/lib/repos/server/clientRepo";
import * as profileRepo from "@/lib/repos/server/profileRepo";
import { sendClientInviteEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/config/appUrl";
import { OWNED_STATUSES } from "@/lib/orders/plan-conflict";

// Human label for an already-purchased product, used to tell the partner this
// email has already bought a plan. Returns null when the profile owns nothing
// paid (a never-paid shell is fine to start a fresh session for).
const PRODUCT_LABELS: Record<string, string> = {
  will: "Will Package",
  trust: "Trust Package",
  amendment: "Amendment",
  vault_subscription: "Vault subscription",
};

async function findOwnedPlanLabel(
  admin: ReturnType<typeof import("@/lib/api/auth").createAdminClient>,
  profileId: string,
): Promise<string | null> {
  const { data: clients } = await admin.from("clients").select("id").eq("profile_id", profileId);
  const clientIds = (clients ?? []).map((c) => c.id);
  if (clientIds.length === 0) return null;
  const { data: orders } = await admin
    .from("orders")
    .select("product_type")
    .in("client_id", clientIds)
    .in("status", OWNED_STATUSES)
    .limit(1);
  const productType = orders?.[0]?.product_type;
  if (!productType) return null;
  return PRODUCT_LABELS[productType] ?? "a plan";
}

// B2: the signed-in partner's clients (with profile + order summaries). Was a
// direct client-side supabase read in app/pro/clients.
export const GET = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["partner"], req);
  if ("error" in auth) return auth.error;

  const { data: partner } = await partnerRepo.getByProfileId(auth.admin, auth.profile.id);
  if (!partner) return ok({ clients: [] });

  const { data: clients } = await clientRepo.listByPartnerWithOrders(auth.admin, partner.id);
  return ok({ clients: clients ?? [] });
});

async function verifyPartnerOwnership(
  admin: ReturnType<typeof import("@/lib/api/auth").createAdminClient>,
  profileId: string,
  partnerId: string,
) {
  const { data: partner } = await admin
    .from("partners")
    .select("id")
    .eq("profile_id", profileId)
    .eq("id", partnerId)
    .single();
  return !!partner;
}

export const POST = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["partner"], req);
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const parsed = partnerClientsCreateSchema.safeParse(body);
  if (!parsed.success) return fail("invalid payload", 400);
  const { firstName, lastName, email, partnerId, action, message } = parsed.data;

  const ownsPartner = await verifyPartnerOwnership(auth.admin, auth.profile.id, partnerId);
  if (!ownsPartner) return fail("forbidden", 403);

  // For an "invite" action we email the client a self-service quiz link. The
  // client row already exists by the time we send, so a mail failure must not
  // fail the request — swallow it (sendClientInviteEmail also logs internally).
  async function sendInviteIfRequested(clientId: string) {
    if (action !== "invite") return;
    const inviteLink = `${getAppUrl()}/quiz?partner=${partnerId}&client=${clientId}`;
    await sendClientInviteEmail({ to: email, firstName, inviteLink, note: message, partnerId }).catch(() => {});
  }

  let profileId: string;
  const { data: existingProfile } = await auth.admin.from("profiles").select("id").eq("email", email).maybeSingle();

  if (existingProfile) {
    profileId = existingProfile.id;

    // Warn the partner before starting a session for an email that has already
    // purchased a plan — don't silently spin up a duplicate client/quiz for
    // someone who already bought. A never-paid shell (label null) still proceeds.
    const ownedPlanLabel = await findOwnedPlanLabel(auth.admin, profileId);
    if (ownedPlanLabel) {
      return fail(`This email already has a ${ownedPlanLabel}. This client has already purchased a plan.`, 409);
    }

    const { data: existingClient } = await auth.admin
      .from("clients")
      .select("id, partner_id")
      .eq("profile_id", profileId)
      .maybeSingle();

    if (existingClient) {
      if (existingClient.partner_id === partnerId) {
        await sendInviteIfRequested(existingClient.id);
        return ok({ clientId: existingClient.id, profileId });
      }
      return fail("This email is already associated with an existing account", 409);
    }
  } else {
    const fullName = `${firstName} ${lastName || ""}`.trim();
    const { data: newUser, error: createErr } = await auth.admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: fullName, user_type: "client" },
    });

    if (createErr || !newUser?.user) {
      // An auth user can exist without a profiles row (orphaned signup, or a
      // profile that was later deleted). createUser then fails "already
      // registered" — re-resolve the existing auth user instead of 500ing.
      if (createErr?.message?.includes("already been registered")) {
        const { data: existingAuthUser } = await auth.admin
          .rpc("find_auth_user_by_email", { lookup_email: email })
          .returns<{ id: string; email: string }[]>()
          .maybeSingle();
        if (!existingAuthUser) return fail("Failed to create user", 500);
        profileId = existingAuthUser.id;
      } else {
        return fail("Failed to create user", 500);
      }
    } else {
      profileId = newUser.user.id;
    }

    // Ensure a profiles row exists for the resolved id (idempotent on id).
    await profileRepo.upsert(auth.admin, { id: profileId, email, full_name: fullName, user_type: "client" });
  }

  const { data: newClient, error: clientErr } = await auth.admin.from("clients").insert({
    profile_id: profileId,
    partner_id: partnerId,
    source: "partner",
    state: "Michigan",
  }).select("id").single();
  if (clientErr || !newClient) return fail("Failed to create client", 500);
  const clientId = newClient.id;

  await auth.admin.from("audit_log").insert({ actor_id: auth.user.id, action: action === "invite" ? "client.invited" : "client.session_started", resource_type: "client", resource_id: clientId, metadata: { partner_id: partnerId, client_email: email } });

  await sendInviteIfRequested(clientId);

  return ok({ clientId, profileId });
});

export const PUT = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["partner"], req);
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const parsedPut = partnerClientsUpdateSchema.safeParse(body);
  if (!parsedPut.success) return fail("invalid payload", 400);
  const { clientId, partnerId, note } = parsedPut.data;

  const ownsPartner = await verifyPartnerOwnership(auth.admin, auth.profile.id, partnerId);
  if (!ownsPartner) return fail("forbidden", 403);

  await auth.admin.from("client_notes").insert({ client_id: clientId, partner_id: partnerId, note });

  return ok({ success: true });
});
