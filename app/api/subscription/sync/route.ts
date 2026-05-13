import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";
import { stripe } from "@/lib/stripe";

function admin() {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { cookies: { getAll: () => [], setAll: () => {} } });
}

// Reconciles clients.vault_subscription_status with Stripe.
// Called when webhook may have been missed (localhost dev, Stripe outage, etc).
export async function POST() {
  const supa = createClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = admin();
  const { data: client } = await db
    .from("clients")
    .select("id, vault_subscription_status, vault_subscription_stripe_id")
    .eq("profile_id", user.id)
    .single();
  if (!client) return NextResponse.json({ status: "none" });

  if (client.vault_subscription_status === "active") {
    return NextResponse.json({ status: "active", source: "db" });
  }

  const email = user.email;
  if (!email) return NextResponse.json({ status: client.vault_subscription_status || "none" });

  // Look up Stripe customer(s) by email, find active vault subscription
  const customers = await stripe.customers.list({ email, limit: 5 });
  for (const cust of customers.data) {
    const subs = await stripe.subscriptions.list({ customer: cust.id, status: "active", limit: 5 });
    const vaultSub = subs.data.find((s) =>
      s.metadata?.product_type === "vault_subscription" ||
      s.items.data.some((it) => it.price.unit_amount === 9900 && it.price.recurring?.interval === "year")
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
      return NextResponse.json({ status: "active", source: "stripe" });
    }
  }

  return NextResponse.json({ status: client.vault_subscription_status || "none" });
}
