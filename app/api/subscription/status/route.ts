import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok } from "@/lib/api/response";

export const GET = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(undefined, req);
  if ("error" in auth) return auth.error;

  const { data: client } = await auth.admin
    .from("clients")
    .select("vault_subscription_status, vault_subscription_expiry")
    .eq("profile_id", auth.user.id)
    .single();

  if (!client) {
    return ok({ status: "none", expiry: null, canAmendFree: false, canUseFarewell: false });
  }

  const isActive = client.vault_subscription_status === "active";
  return ok({
    status: client.vault_subscription_status || "none",
    expiry: client.vault_subscription_expiry,
    canAmendFree: isActive,
    canUseFarewell: isActive,
  });
});
