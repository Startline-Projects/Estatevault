import { NextRequest } from "next/server";
import { stripe } from "@/lib/stripe";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";

export const POST = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(undefined, req);
  if ("error" in auth) return auth.error;

  const { data: client } = await auth.admin
    .from("clients")
    .select("id, vault_subscription_stripe_id, vault_subscription_status")
    .eq("profile_id", auth.user.id)
    .single();

  if (!client || !client.vault_subscription_stripe_id) {
    return fail("No active subscription", 400);
  }

  // Cancel at period end, don't revoke access mid-period
  await stripe.subscriptions.update(client.vault_subscription_stripe_id, {
    cancel_at_period_end: true,
  });

  await auth.admin
    .from("clients")
    .update({ vault_subscription_status: "cancelled" })
    .eq("id", client.id);

  await auth.admin.from("audit_log").insert({
    actor_id: auth.user.id,
    action: "subscription.cancelled",
    resource_type: "client",
    resource_id: client.id,
  });

  return ok({ success: true });
});
