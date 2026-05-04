/**
 * Backfill orders rows for existing vault subscriptions.
 * Run: npx tsx scripts/backfill-vault-orders.ts [partnerEmail]
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const VAULT_PRICE_CENTS = 9900; // $99/year

async function main() {
  const partnerEmail = process.argv[2];

  let partnerQuery = supabase
    .from("partners")
    .select("id, partner_revenue_pct, stripe_account_id, profile_id, profiles:profiles!partners_profile_id_fkey!inner(email)");

  if (partnerEmail) {
    partnerQuery = partnerQuery.eq("profiles.email", partnerEmail);
  }

  const { data: partners, error: pErr } = await partnerQuery;
  if (pErr || !partners) {
    console.error("Partners fetch failed:", pErr);
    process.exit(1);
  }

  for (const partner of partners) {
    const pct = Number(partner.partner_revenue_pct) || 0;
    if (pct <= 0) continue;

    const { data: clients } = await supabase
      .from("clients")
      .select("id, vault_subscription_status, vault_subscription_stripe_id, updated_at, created_at")
      .eq("partner_id", partner.id)
      .eq("vault_subscription_status", "active");

    if (!clients?.length) continue;

    for (const client of clients) {
      // Skip if order already exists for this client's vault sub
      const { data: existing } = await supabase
        .from("orders")
        .select("id")
        .eq("client_id", client.id)
        .eq("product_type", "vault_subscription")
        .maybeSingle();

      if (existing) {
        console.log(`Skip client ${client.id} — order exists`);
        continue;
      }

      const partnerCut = Math.round((VAULT_PRICE_CENTS * pct) / 100);
      const evCut = VAULT_PRICE_CENTS - partnerCut;

      const { error: insErr } = await supabase.from("orders").insert({
        client_id: client.id,
        partner_id: partner.id,
        product_type: "vault_subscription",
        status: "delivered",
        amount_total: VAULT_PRICE_CENTS,
        partner_cut: partnerCut,
        ev_cut: evCut,
        created_at: client.updated_at || client.created_at,
      });

      if (insErr) {
        console.error(`Insert failed for client ${client.id}:`, insErr);
      } else {
        console.log(`Backfilled order for client ${client.id} → partner_cut=${partnerCut}c`);
      }
    }
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
