import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { ok, fail } from "@/lib/api/response";
import { withRoute } from "@/lib/api/route";

export const GET = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["sales_rep", "admin"], req);
  if ("error" in auth) return auth.error;

  const partnerId = new URL(req.url).searchParams.get("partnerId");
  if (!partnerId) return ok({ notes: [] });

  const { data } = await auth.admin.from("sales_partner_notes").select("*").eq("partner_id", partnerId).order("created_at", { ascending: false });
  return ok({ notes: data || [] });
});

export const POST = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["sales_rep", "admin"], req);
  if ("error" in auth) return auth.error;

  const { partnerId, note } = await req.json();
  if (!partnerId || !note) return fail("Missing fields", 400);

  await auth.admin.from("sales_partner_notes").insert({ partner_id: partnerId, sales_rep_id: auth.user.id, note });
  return ok({ success: true });
});
