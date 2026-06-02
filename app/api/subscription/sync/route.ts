import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok } from "@/lib/api/response";
import { stripe } from "@/lib/stripe";
import { PRICES } from "@/lib/orders/pricing";

// Reconciles clients.vault_subscription_status with Stripe.
// Called when webhook may have been missed (localhost dev, Stripe outage, etc).
export const POST = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(undefined, req);
  if ("error" in auth) return auth.error;
  const user = auth.user;

  const db = auth.admin;
  const { data: client } = await db
    .from("clients")
    .select("id, vault_subscription_status, vault_subscription_stripe_id")
    .eq("profile_id", user.id)
    .single();
  if (!client) return ok({ status: "none" });

  if (client.vault_subscription_status === "active") {
    return ok({ status: "active", source: "db" });
  }

  const email = user.email;
  if (!email) return ok({ status: client.vault_subscription_status || "none" });

  // Look up Stripe customer(s) by email, find active vault subscription
  const customers = await stripe.customers.list({ email, limit: 5 });
  for (const cust of customers.data) {
    const subs = await stripe.subscriptions.list({ customer: cust.id, status: "active", limit: 5 });
    const vaultSub = subs.data.find((s) =>
      s.metadata?.product_type === "vault_subscription" ||
      s.items.data.some((it) => it.price.unit_amount === PRICES.vaultSubscriptionYear && it.price.recurring?.interval === "year")
    );
    if (vaultSub) {
      const periodEnd = vaultSub.items.data[0]?.current_period_end ?? (Date.now() / 1000 + 365 * 86400);
      const expiry = new Date(periodEnd * 1000);
      await db.from("clients").update({
        vault_subscription_status: "active",
        vault_subscription_expiry: expiry.toISOString(),
        vault_subscription_stripe_id: vaultSub.id,
      }).eq("id", client.id);
      await db.from("audit_log").insert({
        actor_id: user.id,
        action: "subscription.synced_from_stripe",
        resource_type: "client",
        resource_id: client.id,
        metadata: { subscription_id: vaultSub.id },
      });
      return ok({ status: "active", source: "stripe" });
    }
  }

  return ok({ status: client.vault_subscription_status || "none" });
});
