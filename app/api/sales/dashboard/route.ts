import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok } from "@/lib/api/response";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";
import * as orderRepo from "@/lib/repos/server/orderRepo";
import * as profileRepo from "@/lib/repos/server/profileRepo";
import * as professionalLeadRepo from "@/lib/repos/server/professionalLeadRepo";

// B2: the sales dashboard summary, aggregated server-side (was ~6 direct
// client-side supabase reads + a stack of derived stats).
export const GET = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["sales_rep", "admin", "review_attorney"], req);
  if ("error" in auth) return auth.error;

  const userType = auth.profile.user_type;
  const isAdmin = userType === "admin" || userType === "review_attorney";

  const { data: me } = await profileRepo.getMeById(auth.admin, auth.user.id);
  const repName = me?.full_name || me?.email?.split("@")[0] || "Rep";

  const { data: partnersRaw } = await partnerRepo.listManagedForDashboard(
    auth.admin,
    isAdmin ? null : auth.user.id,
  );
  const partners = partnersRaw ?? [];

  const activePartners = partners.filter((p) => p.status === "active").length;
  const onboardingPartners = partners.filter((p) => !p.onboarding_completed).length;

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const partnerIds = partners.map((p) => p.id);
  const { data: ordersRaw } = partnerIds.length
    ? await orderRepo.listMtdByPartnerIds(auth.admin, partnerIds, monthStart)
    : { data: [] };
  const orders = ordersRaw ?? [];

  const mtdEvRevenue = orders.reduce((s, o) => s + (o.ev_cut || 0), 0) / 100;
  const mtdPlatformFees =
    partners
      .filter((p) => p.one_time_fee_paid && p.created_at && new Date(p.created_at) >= new Date(monthStart))
      .reduce((s, p) => s + (p.platform_fee_amount || 0), 0) / 100;

  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const stuckPartners = partners
    .filter((p) => !p.onboarding_completed && p.updated_at && new Date(p.updated_at) < threeDaysAgo)
    .map((p) => ({
      id: p.id,
      company_name: p.company_name,
      onboarding_step: p.onboarding_step,
      daysSinceUpdate: Math.floor((Date.now() - new Date(p.updated_at as string).getTime()) / 86_400_000),
    }));

  const recentPartners = [...partners]
    .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
    .slice(0, 5)
    .map((p) => {
      const pOrders = orders.filter((o) => o.partner_id === p.id);
      return {
        id: p.id,
        company_name: p.company_name,
        tier: p.tier,
        status: p.status,
        mtdDocs: pOrders.length,
        mtdRevenue: pOrders.reduce((s, o) => s + (o.partner_cut || 0), 0) / 100,
      };
    });

  const { data: leads } = await professionalLeadRepo.listActive(auth.admin, 10);

  const { data: pendingRaw } = await partnerRepo.listPendingAttorneyVerifications(auth.admin);
  const pending = pendingRaw ?? [];
  const pendingProfileIds = pending.map((p) => p.profile_id).filter((x): x is string => !!x);
  const { data: pendingProfiles } = pendingProfileIds.length
    ? await profileRepo.listByIds(auth.admin, pendingProfileIds)
    : { data: [] };
  const profileMap = Object.fromEntries((pendingProfiles ?? []).map((p) => [p.id, p]));
  const pendingVerifications = pending.map((p) => ({
    id: p.id,
    company_name: p.company_name,
    bar_number: p.bar_number || "N/A",
    tier: p.tier,
    review_fee: p.custom_review_fee,
    created_at: p.created_at ?? "",
    profile_name: p.profile_id ? profileMap[p.profile_id]?.full_name || "Unknown" : "Unknown",
    profile_email: p.profile_id ? profileMap[p.profile_id]?.email || "" : "",
  }));

  return ok({
    repName,
    userType,
    activePartners,
    onboardingPartners,
    mtdEvRevenue,
    mtdPlatformFees,
    stuckPartners,
    recentPartners,
    leads: leads ?? [],
    pendingVerifications,
  });
});
