import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { salesLeadStatusSchema } from "@/lib/validation/schemas";
import * as professionalLeadRepo from "@/lib/repos/server/professionalLeadRepo";

type Ctx = { params: Promise<{ leadId: string }> };

// B2: a sales rep/admin updates a professional lead's status (e.g. mark
// contacted). Was a direct client-side `supabase.from("professional_leads")`
// update in app/pro/sales + app/sales/dashboard.
export const PATCH = withRoute(async (req: NextRequest, ctx: Ctx) => {
  const auth = await requireAuth(["sales_rep", "admin", "review_attorney"], req);
  if ("error" in auth) return auth.error;

  const { leadId } = await ctx.params;
  const parsed = salesLeadStatusSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid payload", 400);

  await professionalLeadRepo.updateStatus(auth.admin, leadId, parsed.data.status);
  return ok({ success: true });
});
