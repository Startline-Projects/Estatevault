import { NextRequest } from "next/server";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { requireAdmin } from "@/lib/marketing/admin-auth";

export const GET = withRoute(async (_req: NextRequest) => {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error, auth.status);

  const { data, error } = await auth.admin
    .from("partners")
    .select("id, company_name, marketing_slug")
    .order("company_name", { ascending: true });
  if (error) return fail(error.message, 500);

  return ok({ partners: data || [] });
});
