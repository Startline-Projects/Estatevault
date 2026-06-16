import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { ok, fail } from "@/lib/api/response";
import { salesPartnerNotesSchema } from "@/lib/validation/schemas";
import { withRoute } from "@/lib/api/route";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";

// BUG-19: a sales rep may only touch notes for partners they created; admins
// see all. Mirrors loadOwned in sales/partners/[partnerId]/route.ts so a
// guessed partnerId can't leak (or write to) another rep's deal notes.
async function ownsPartner(auth: Awaited<ReturnType<typeof requireAuth>>, partnerId: string) {
  if ("error" in auth) return false;
  if (auth.profile.user_type === "admin") return true;
  const { data: partner } = await partnerRepo.getById(auth.admin, partnerId);
  return !!partner && partner.created_by === auth.user.id;
}

export const GET = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["sales_rep", "admin"], req);
  if ("error" in auth) return auth.error;

  const partnerId = new URL(req.url).searchParams.get("partnerId");
  if (!partnerId) return ok({ notes: [] });
  if (!(await ownsPartner(auth, partnerId))) return ok({ notes: [] });

  const { data } = await auth.admin.from("sales_partner_notes").select("*").eq("partner_id", partnerId).order("created_at", { ascending: false });
  return ok({ notes: data || [] });
});

export const POST = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["sales_rep", "admin"], req);
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const parsed = salesPartnerNotesSchema.safeParse(body);
  if (!parsed.success) return fail("invalid payload", 400);
  const { partnerId, note } = parsed.data;

  if (!(await ownsPartner(auth, partnerId))) return fail("partner not found", 404);

  await auth.admin.from("sales_partner_notes").insert({ partner_id: partnerId, sales_rep_id: auth.user.id, note });
  return ok({ success: true });
});
