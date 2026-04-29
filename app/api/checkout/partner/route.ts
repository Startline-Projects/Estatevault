import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";

function createAdminClient() {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { cookies: { getAll: () => [], setAll: () => {} } });
}

export async function POST(request: Request) {
  try {
    const { partnerId, tier } = await request.json();
    if (!partnerId || !tier) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const authClient = createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const amount = tier === "enterprise" ? 600000 : tier === "basic" ? 50000 : 120000;
    const planName = tier === "enterprise" ? "Enterprise" : tier === "basic" ? "Basic" : "Standard";
    const successPath = tier === "basic" ? "/pro/onboarding/step-2-vault" : "/pro/onboarding/step-2";

    const origin = request.headers.get("origin") || "https://www.estatevault.us";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        price_data: { currency: "usd", product_data: { name: `EstateVault ${planName} — White-Label Vault Access`, description: `${planName} partner platform one-time fee` }, unit_amount: amount },
        quantity: 1,
      }],
      success_url: `${origin}${successPath}`,
      cancel_url: `${origin}/pro/onboarding/step-1`,
      metadata: { partner_id: partnerId, tier, type: "partner_platform_fee" },
    });

    // Update tier immediately
    const admin = createAdminClient();
    await admin.from("partners").update({ tier, stripe_session_id: session.id }).eq("id", partnerId);

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Partner checkout error:", error);
    return NextResponse.json({ error: "Failed to create checkout" }, { status: 500 });
  }
}
