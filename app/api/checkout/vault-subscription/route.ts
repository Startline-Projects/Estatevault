import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";

function createAdminClient() {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { cookies: { getAll: () => [], setAll: () => {} } });
}

export async function POST(request: Request) {
  try {
    const authClient = createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createAdminClient();
    const { data: client } = await supabase
      .from("clients")
      .select("id, vault_subscription_status")
      .eq("profile_id", user.id)
      .single();

    if (!client) return NextResponse.json({ error: "No client record" }, { status: 400 });

    if (client.vault_subscription_status === "active") {
      return NextResponse.json({ error: "Already subscribed" }, { status: 400 });
    }

    const origin = request.headers.get("origin") || "https://www.estatevault.us";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: user.email || undefined,
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: "EstateVault Vault Plan",
            description: "Annual vault subscription — free amendments, farewell messages, annual review reminders, priority processing",
          },
          unit_amount: 9900,
          recurring: { interval: "year" },
        },
        quantity: 1,
      }],
      success_url: `${origin}/dashboard/vault?subscribed=true`,
      cancel_url: `${origin}/dashboard/vault`,
      metadata: {
        client_id: client.id,
        product_type: "vault_subscription",
        user_id: user.id,
      },
    });

    // Audit log
    await supabase.from("audit_log").insert({
      actor_id: user.id,
      action: "subscription.checkout_started",
      resource_type: "client",
      resource_id: client.id,
      metadata: { session_id: session.id },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Vault subscription checkout error:", error);
    return NextResponse.json({ error: "Failed to create checkout" }, { status: 500 });
  }
}
