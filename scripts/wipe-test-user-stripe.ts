/**
 * Per-user Stripe cleanup — companion to scripts/wipe-test-user.sql.
 *
 * The SQL/Storage wipes clear the DB, but the live Stripe subscription
 * survives. /api/subscription/sync looks Stripe up by EMAIL and resurrects
 * vault_subscription_status='active' on the recreated client — so the vault
 * banner shows "Active" and never prompts to subscribe again.
 *
 * This immediately cancels any vault subscription for the email so a fresh
 * signup starts clean.
 *
 * Run: npx tsx scripts/wipe-test-user-stripe.ts <email>
 */
import Stripe from "stripe";
import * as dotenv from "dotenv";
import { PRICES } from "../lib/orders/pricing";
dotenv.config({ path: ".env.local" });

const email = (process.argv[2] ?? "waleed50602@gmail.com").toLowerCase();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
  typescript: true,
});

function isVaultSub(s: Stripe.Subscription): boolean {
  return (
    s.metadata?.product_type === "vault_subscription" ||
    s.items.data.some(
      (it) =>
        it.price.unit_amount === PRICES.vaultSubscriptionYear && it.price.recurring?.interval === "year"
    )
  );
}

async function main() {
  const customers = await stripe.customers.list({ email, limit: 100 });
  if (customers.data.length === 0) {
    console.log(`No Stripe customer for ${email}.`);
    return;
  }

  let cancelled = 0;
  for (const cust of customers.data) {
    // status:'all' so we also clear trialing / past_due / unpaid, not just active.
    const subs = await stripe.subscriptions.list({
      customer: cust.id,
      status: "all",
      limit: 100,
    });
    for (const sub of subs.data) {
      if (sub.status === "canceled") continue;
      if (!isVaultSub(sub)) continue;
      await stripe.subscriptions.cancel(sub.id); // immediate, not period-end
      console.log(`Cancelled ${sub.id} (customer ${cust.id}, was ${sub.status})`);
      cancelled++;
    }
  }

  console.log(
    cancelled === 0
      ? `No live vault subscription for ${email}.`
      : `Cancelled ${cancelled} vault subscription(s) for ${email}.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
