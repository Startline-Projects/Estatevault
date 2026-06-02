import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok } from "@/lib/api/response";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";
import * as clientRepo from "@/lib/repos/server/clientRepo";
import * as orderRepo from "@/lib/repos/server/orderRepo";
import * as referralRepo from "@/lib/repos/server/referralRepo";
import * as auditLogRepo from "@/lib/repos/server/auditLogRepo";

const ACTIVE_DOC_STATUSES = ["paid", "delivered", "generating", "review"];

// B2: the pro/dashboard summary, aggregated server-side (was a stack of direct
// client-side supabase queries + counts).
export const GET = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["partner"], req);
  if ("error" in auth) return auth.error;

  const { data: partner } = await partnerRepo.getByProfileId(auth.admin, auth.profile.id);
  if (!partner) return ok({ partner: null });

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const isBasic = partner.tier === "basic";

  let stats = { clients: 0, docsThisMonth: 0, mtdEarnings: 0, referralFees: 0 };
  let vaultStats = { vaultClients: 0, activeSubscriptions: 0 };

  if (isBasic) {
    const [{ count: vaultClients }, { count: activeSubscriptions }] = await Promise.all([
      clientRepo.countByPartner(auth.admin, partner.id),
      clientRepo.countActiveVaultByPartner(auth.admin, partner.id),
    ]);
    vaultStats = { vaultClients: vaultClients ?? 0, activeSubscriptions: activeSubscriptions ?? 0 };
  } else {
    const [{ count: clients }, { data: monthOrders }, { data: refs }] = await Promise.all([
      clientRepo.countByPartner(auth.admin, partner.id),
      orderRepo.listSinceByPartner(auth.admin, partner.id, monthStart),
      referralRepo.listPaidSince(auth.admin, partner.id, monthStart),
    ]);
    const active = (monthOrders ?? []).filter((o) => !!o.status && ACTIVE_DOC_STATUSES.includes(o.status));
    const mtdEarnings = active.reduce((s, o) => s + (o.partner_cut || 0), 0);
    const referralFees = (refs ?? []).reduce((s, r) => s + (r.referral_fee || 0), 0);
    stats = {
      clients: clients ?? 0,
      docsThisMonth: active.length,
      mtdEarnings: mtdEarnings / 100,
      referralFees: referralFees / 100,
    };
  }

  const { data: recentActivity } = await auditLogRepo.listRecent(auth.admin, 10);

  return ok({
    partner: {
      id: partner.id,
      company_name: partner.company_name,
      business_url: partner.business_url,
      certification_completed: partner.certification_completed,
      tier: partner.tier,
      vault_subdomain: partner.vault_subdomain,
      accent_color: partner.accent_color,
    },
    stats,
    vaultStats,
    recentActivity: recentActivity ?? [],
  });
});
