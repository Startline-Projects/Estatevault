import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";

export const POST = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(undefined, req);
  if ("error" in auth) return auth.error;

  const { data: client } = await auth.admin
    .from("clients")
    .select("id")
    .eq("profile_id", auth.user.id)
    .single();

  if (!client) return fail("Client not found", 404);

  await auth.admin
    .from("clients")
    .update({ documents_executed: true, documents_executed_at: new Date().toISOString() })
    .eq("id", client.id);

  await auth.admin.from("audit_log").insert({
    actor_id: auth.user.id,
    action: "client.documents_executed",
    resource_type: "client",
    resource_id: client.id,
  });

  return ok({ success: true });
});
