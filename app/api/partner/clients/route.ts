import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { ok, fail } from "@/lib/api/response";
import { partnerClientsCreateSchema, partnerClientsUpdateSchema } from "@/lib/validation/schemas";
import { withRoute } from "@/lib/api/route";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";
import * as clientRepo from "@/lib/repos/server/clientRepo";

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
  const { firstName, lastName, email, partnerId, action } = parsed.data;

  const ownsPartner = await verifyPartnerOwnership(auth.admin, auth.profile.id, partnerId);
  if (!ownsPartner) return fail("forbidden", 403);

  let profileId: string;
  const { data: existingProfile } = await auth.admin.from("profiles").select("id").eq("email", email).single();

  if (existingProfile) {
    profileId = existingProfile.id;
  } else {
    const { data: newUser, error: createErr } = await auth.admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: `${firstName} ${lastName || ""}`.trim(), user_type: "client" },
    });
    if (createErr || !newUser.user) {
      return fail("Failed to create user", 500);
    }
    profileId = newUser.user.id;

    const { data: check } = await auth.admin.from("profiles").select("id").eq("id", profileId).single();
    if (!check) {
      await auth.admin.from("profiles").insert({ id: profileId, email, full_name: `${firstName} ${lastName || ""}`.trim(), user_type: "client" });
    }
  }

  const { data: existingClient } = await auth.admin.from("clients").select("id").eq("profile_id", profileId).eq("partner_id", partnerId).single();

  let clientId: string;
  if (existingClient) {
    clientId = existingClient.id;
  } else {
    const { data: newClient, error: clientErr } = await auth.admin.from("clients").insert({
      profile_id: profileId,
      partner_id: partnerId,
      source: "partner",
      state: "Michigan",
    }).select("id").single();
    if (clientErr || !newClient) return fail("Failed to create client", 500);
    clientId = newClient.id;
  }

  await auth.admin.from("audit_log").insert({ actor_id: auth.user.id, action: action === "invite" ? "client.invited" : "client.session_started", resource_type: "client", resource_id: clientId, metadata: { partner_id: partnerId, client_email: email } });

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
