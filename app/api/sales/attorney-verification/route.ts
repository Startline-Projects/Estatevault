import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { attorneyVerificationSchema } from "@/lib/validation/schemas";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";

// B2: a sales rep/admin activates or rejects a pending attorney bar-verification.
// Was a direct client-side `supabase.from("partners").update({ status })` in
// app/pro/sales. Pending-verification partners are platform-wide (listed via
// listPendingAttorneyVerifications), so this is a sales/admin privilege, not
// created_by-scoped — the role gate is the authorization.
export const POST = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["sales_rep", "admin", "review_attorney"], req);
  if ("error" in auth) return auth.error;

  const parsed = attorneyVerificationSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid payload", 400);

  const status = parsed.data.action === "activate" ? "active" : "rejected";
  await partnerRepo.update(auth.admin, parsed.data.partnerId, { status });
  return ok({ success: true });
});
