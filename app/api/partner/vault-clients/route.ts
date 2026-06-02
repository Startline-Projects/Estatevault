import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok } from "@/lib/api/response";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";
import * as clientRepo from "@/lib/repos/server/clientRepo";

// B2: the signed-in partner's vault-subscription clients (was a direct
// client-side supabase read in app/pro/vault-clients).
export const GET = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["partner"], req);
  if ("error" in auth) return auth.error;

  const { data: partner } = await partnerRepo.getByProfileId(auth.admin, auth.profile.id);
  if (!partner) return ok({ clients: [] });

  const { data: clients } = await clientRepo.listVaultClientsByPartner(auth.admin, partner.id);
  return ok({ clients: clients ?? [] });
});
