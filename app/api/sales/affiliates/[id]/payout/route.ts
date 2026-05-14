export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";
import { transferToAffiliateBatch } from "@/lib/stripe-payouts";

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

// Payouts in any non-terminal/successful state count against the balance owed,
// so a re-click while a payout is in flight can't double-pay the affiliate.
const COVERING_PAYOUT_STATUSES = ["pending", "processing", "sent"];

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("user_type")
      .eq("id", user.id)
      .single();
    if (profile?.user_type !== "admin")
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );

    const affiliateId = params.id;
    const { data: affiliate } = await admin
      .from("affiliates")
      .select("id, stripe_account_id, stripe_onboarding_complete")
      .eq("id", affiliateId)
      .single();
    if (!affiliate)
      return NextResponse.json(
        { error: "Affiliate not found" },
        { status: 404 }
      );
    if (!affiliate.stripe_account_id || !affiliate.stripe_onboarding_complete)
      return NextResponse.json(
        { error: "Affiliate has not completed Stripe onboarding" },
        { status: 400 }
      );

    // Earned = affiliate_cut across all non-pending attributed orders.
    const { data: orders } = await admin
      .from("orders")
      .select("id, affiliate_cut, status")
      .eq("affiliate_id", affiliateId)
      .neq("status", "pending");
    const earned = (orders ?? []).reduce(
      (s, o) => s + (o.affiliate_cut || 0),
      0
    );

    // Subtract anything already covered by an existing payout.
    const { data: priorPayouts } = await admin
      .from("affiliate_payouts")
      .select("amount_cents, status")
      .eq("affiliate_id", affiliateId);
    const covered = (priorPayouts ?? [])
      .filter((p) => COVERING_PAYOUT_STATUSES.includes(p.status))
      .reduce((s, p) => s + (p.amount_cents || 0), 0);

    const unpaid = earned - covered;
    if (unpaid <= 0)
      return NextResponse.json(
        { error: "No unpaid balance to pay out" },
        { status: 400 }
      );

    const orderIds = (orders ?? []).map((o) => o.id);

    const transfer = await transferToAffiliateBatch(
      affiliate.stripe_account_id,
      unpaid,
      affiliateId,
      orderIds
    );
    if (!transfer)
      return NextResponse.json(
        { error: "Stripe transfer failed" },
        { status: 500 }
      );

    await admin.from("affiliate_payouts").insert({
      affiliate_id: affiliateId,
      amount_cents: unpaid,
      status: "sent",
      stripe_transfer_id: transfer.id,
      orders_included: orderIds,
      paid_at: new Date().toISOString(),
    });

    try {
      await admin.from("audit_log").insert({
        actor_id: user.id,
        action: "affiliate.payout_sent",
        resource_type: "affiliate",
        resource_id: affiliateId,
        metadata: {
          amount_cents: unpaid,
          stripe_transfer_id: transfer.id,
          order_count: orderIds.length,
        },
      });
    } catch {
      // audit log is best-effort
    }

    return NextResponse.json({
      success: true,
      amount_cents: unpaid,
      transfer_id: transfer.id,
    });
  } catch (error) {
    console.error("Affiliate payout error:", error);
    return NextResponse.json({ error: "Payout failed" }, { status: 500 });
  }
}
