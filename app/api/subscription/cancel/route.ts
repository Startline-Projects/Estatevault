import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";

function createAdminClient() {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { cookies: { getAll: () => [], setAll: () => {} } });
}

export async function POST() {
  try {
    const authClient = createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createAdminClient();
    const { data: client } = await supabase
      .from("clients")
      .select("id, vault_subscription_stripe_id, vault_subscription_status")
      .eq("profile_id", user.id)
      .single();

    if (!client || !client.vault_subscription_stripe_id) {
      return NextResponse.json({ error: "No active subscription" }, { status: 400 });
    }

    // Cancel at period end, don't revoke access mid-period
    await stripe.subscriptions.update(client.vault_subscription_stripe_id, {
      cancel_at_period_end: true,
    });

    await supabase
      .from("clients")
      .update({ vault_subscription_status: "cancelled" })
      .eq("id", client.id);

    await supabase.from("audit_log").insert({
      actor_id: user.id,
      action: "subscription.cancelled",
      resource_type: "client",
      resource_id: client.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Subscription cancel error:", error);
    return NextResponse.json({ error: "Failed to cancel" }, { status: 500 });
  }
}
