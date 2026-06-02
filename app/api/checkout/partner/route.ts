import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { withRoute } from "@/lib/api/route";
import { partnerCheckoutSchema } from "@/lib/validation/schemas";
import { PARTNER_PLATFORM_FEE } from "@/lib/orders/pricing";

export const POST = withRoute(async (request: Request) => {
  try {
    const body = await request.json();
    const parsed = partnerCheckoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Missing fields", details: parsed.error.flatten() }, { status: 400 });
    }
    const { partnerId, tier } = parsed.data;

    const authClient = createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const amount = PARTNER_PLATFORM_FEE[tier];
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

    // H-6: tier is applied only after payment confirms (in the webhook
    // partner_platform_fee branch) — an abandoned checkout must not grant a
    // free tier upgrade. The target tier rides along in session metadata.

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Partner checkout error:", error);
    return NextResponse.json({ error: "Failed to create checkout" }, { status: 500 });
  }
});
