import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok } from "@/lib/api/response";
import * as profileRepo from "@/lib/repos/server/profileRepo";
import * as clientRepo from "@/lib/repos/server/clientRepo";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";

// B2: everything the login screen needs to route a just-authenticated user —
// their role, the whitelabel hosts of their managing partner (for the client
// lockout), and partner onboarding state. Replaces 3 direct browser reads of
// profiles/clients/partners plus the get_partner_login_target RPC. The
// host-matching decision stays client-side (it reads window.location).
export const GET = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(undefined, req);
  if ("error" in auth) return auth.error;

  const { data: profile } = await profileRepo.getMeById(auth.admin, auth.user.id);
  const userType = profile?.user_type || "client";

  let clientPartner: {
    company_name: string | null;
    subdomain: string | null;
    custom_domain: string | null;
    vault_subdomain: string | null;
  } | null = null;
  let partnerOnboarding: { onboarding_completed: boolean | null; status: string | null } | null = null;

  if (userType === "client") {
    const { data: clientRow } = await clientRepo.getPartnerIdByProfile(auth.admin, auth.user.id);
    if (clientRow?.partner_id) {
      const { data: p } = await partnerRepo.getLoginHostsById(auth.admin, clientRow.partner_id);
      clientPartner = p ?? null;
    }
  } else if (userType === "partner") {
    const { data: partner } = await partnerRepo.getByProfileId(auth.admin, auth.user.id);
    partnerOnboarding = partner
      ? { onboarding_completed: partner.onboarding_completed, status: partner.status }
      : null;
  }

  return ok({ userType, clientPartner, partnerOnboarding });
});
