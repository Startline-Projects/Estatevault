import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { salesPartnerStatusSchema, adminPartnerFeeSchema } from "@/lib/validation/schemas";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";
import * as orderRepo from "@/lib/repos/server/orderRepo";
import * as auditLogRepo from "@/lib/repos/server/auditLogRepo";

type Ctx = { params: Promise<{ partnerId: string }> };

// Admins + review attorneys manage all partners; a sales rep manages only the
// partners they created (created_by). Returns the partner row or null if the
// caller is a rep who does not own it (the route maps that to 404, so a foreign
// id never leaks data — the guard the old client-side page lacked).
async function loadOwned(auth: Awaited<ReturnType<typeof requireAuth>>, partnerId: string) {
  if ("error" in auth) return null;
  const isAdmin = auth.profile.user_type === "admin" || auth.profile.user_type === "review_attorney";
  const { data: partner } = await partnerRepo.getById(auth.admin, partnerId);
  if (!partner) return null;
  if (!isAdmin && partner.created_by !== auth.user.id) return null;
  return partner;
}

export const GET = withRoute(async (req: NextRequest, ctx: Ctx) => {
  const auth = await requireAuth(["sales_rep", "admin", "review_attorney"], req);
  if ("error" in auth) return auth.error;

  const { partnerId } = await ctx.params;
  const partner = await loadOwned(auth, partnerId);
  if (!partner) return fail("partner not found", 404);

  // Performance buckets, computed from one paid-orders read.
  const { data: orders } = await orderRepo.listPaidByPartner(auth.admin, partnerId);
  const rows = orders ?? [];
  const now = new Date();
  const mtdStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const lmStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const lmEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

  const sum = (rs: typeof rows) => rs.reduce((s, o) => s + (o.partner_cut || 0), 0);
  const mtd = rows.filter((o) => (o.created_at ?? "") >= mtdStart);
  const lm = rows.filter((o) => (o.created_at ?? "") >= lmStart && (o.created_at ?? "") <= lmEnd);

  const months: { month: string; docs: number; revenue: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
    const inMonth = rows.filter(
      (o) => (o.created_at ?? "") >= mStart.toISOString() && (o.created_at ?? "") <= mEnd.toISOString(),
    );
    months.push({
      month: mStart.toLocaleString("default", { month: "short" }),
      docs: inMonth.length,
      revenue: sum(inMonth) / 100,
    });
  }

  const performance = {
    mtdDocs: mtd.length,
    mtdRevenue: sum(mtd) / 100,
    lmDocs: lm.length,
    lmRevenue: sum(lm) / 100,
    allDocs: rows.length,
    allRevenue: sum(rows) / 100,
    monthlyStats: months,
  };

  const { data: activity } = await auditLogRepo.listByResource(auth.admin, partnerId, 50);
  const { data: notes } = await auth.admin
    .from("sales_partner_notes")
    .select("id, note, sales_rep_id, created_at")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false });

  return ok({ partner, performance, activity: activity ?? [], notes: notes ?? [] });
});

export const PATCH = withRoute(async (req: NextRequest, ctx: Ctx) => {
  const auth = await requireAuth(["sales_rep", "admin", "review_attorney"], req);
  if ("error" in auth) return auth.error;

  const { partnerId } = await ctx.params;
  const partner = await loadOwned(auth, partnerId);
  if (!partner) return fail("partner not found", 404);

  const body = await req.json().catch(() => null);
  const isAdmin =
    auth.profile.user_type === "admin" || auth.profile.user_type === "review_attorney";

  // Admin-only: set this partner's attorney review fee (clamped at the schema
  // boundary to ATTORNEY_REVIEW_FEE_RANGE). Partners cannot set their own (BUG-4).
  const fee = adminPartnerFeeSchema.safeParse(body);
  if (fee.success) {
    if (!isAdmin) return fail("forbidden", 403);
    await partnerRepo.update(auth.admin, partnerId, {
      custom_review_fee: fee.data.custom_review_fee,
    });
    return ok({ success: true });
  }

  const parsed = salesPartnerStatusSchema.safeParse(body);
  if (!parsed.success) return fail("invalid payload", 400);

  await partnerRepo.update(auth.admin, partnerId, { status: parsed.data.status });
  return ok({ success: true });
});
