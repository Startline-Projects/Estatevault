import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok } from "@/lib/api/response";
import { PRICES } from "@/lib/orders/pricing";
import * as partnerRepo from "@/lib/repos/server/partnerRepo";
import * as orderRepo from "@/lib/repos/server/orderRepo";
import * as clientRepo from "@/lib/repos/server/clientRepo";
import * as payoutRepo from "@/lib/repos/server/payoutRepo";

type RevenueOrder = {
  id: string;
  client_id: string | null;
  product_type: string;
  partner_cut: number;
  status: string;
  created_at: string | null;
};

// B2: the raw inputs for the pro/revenue page — active orders (with synthesized
// vault-subscription rows for active clients missing one) + payouts. The screen
// keeps the mtd/ytd/breakdown math; this just moves the reads behind the API.
export const GET = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["partner"], req);
  if ("error" in auth) return auth.error;

  const { data: partner } = await partnerRepo.getByProfileId(auth.admin, auth.profile.id);
  if (!partner) return ok({ orders: [], payouts: [] });

  const partnerPct = Number(partner.partner_revenue_pct) || 0;

  const { data: ordersRaw } = await orderRepo.listActiveByPartner(auth.admin, partner.id);
  const orders: RevenueOrder[] = (ordersRaw ?? []).map((o) => ({
    id: o.id,
    client_id: o.client_id,
    product_type: o.product_type,
    partner_cut: o.partner_cut || 0,
    status: o.status || "",
    created_at: o.created_at,
  }));

  // Synthesize vault_subscription orders for active clients lacking a tracked row.
  if (partnerPct > 0) {
    const { data: vaultClients } = await clientRepo.listActiveVaultRaw(auth.admin, partner.id);
    const tracked = new Set(
      orders.filter((o) => o.product_type === "vault_subscription" && o.client_id).map((o) => o.client_id as string),
    );
    const partnerCutCents = Math.round((PRICES.vaultSubscriptionYear * partnerPct) / 100);
    for (const c of vaultClients ?? []) {
      if (tracked.has(c.id)) continue;
      orders.push({
        id: `synthetic-${c.id}`,
        client_id: c.id,
        product_type: "vault_subscription",
        partner_cut: partnerCutCents,
        status: "paid",
        created_at: c.updated_at || c.created_at,
      });
    }
  }

  const { data: payouts } = await payoutRepo.listByPartner(auth.admin, partner.id);

  return ok({ orders, payouts: payouts ?? [] });
});
