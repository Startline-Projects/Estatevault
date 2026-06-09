import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok } from "@/lib/api/response";
import { hasVaultAccess } from "@/lib/repos/server/clientRepo";

const DAY_MS = 24 * 60 * 60 * 1000;

export const GET = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(undefined, req);
  if ("error" in auth) return auth.error;

  const { data: client } = await auth.admin
    .from("clients")
    .select("vault_subscription_status, vault_subscription_expiry")
    .eq("profile_id", auth.user.id)
    .single();

  if (!client) {
    return ok({ status: "none", expiry: null, canAmendFree: false, canUseFarewell: false, cancelAtPeriodEnd: false, daysRemaining: null });
  }

  const status = client.vault_subscription_status || "none";
  const expiry = client.vault_subscription_expiry;
  // A cancelled-but-not-yet-expired sub keeps full benefits until the paid term ends.
  const hasAccess = hasVaultAccess(status, expiry);
  const cancelAtPeriodEnd = status === "cancelled" && hasAccess;
  const daysRemaining = expiry
    ? Math.max(0, Math.ceil((new Date(expiry).getTime() - Date.now()) / DAY_MS))
    : null;

  return ok({
    status,
    expiry,
    canAmendFree: hasAccess,
    canUseFarewell: hasAccess,
    cancelAtPeriodEnd,
    daysRemaining,
  });
});
