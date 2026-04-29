import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";

function createAdminClient() {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { cookies: { getAll: () => [], setAll: () => {} } });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const { data: partner } = await admin.from("partners").select("id, stripe_account_id").eq("profile_id", user.id).single();
  if (!partner) return NextResponse.json({ error: "Partner not found" }, { status: 404 });

  const origin = request.headers.get("origin") || "https://www.estatevault.us";
  const body = await request.json().catch(() => ({}));
  const returnPath: string = body.returnPath || "/pro/settings";

  let accountId = partner.stripe_account_id;

  try {
    if (!accountId) {
      const account = await stripe.accounts.create({
        controller: {
          stripe_dashboard: { type: "express" },
          fees: { payer: "application" },
          losses: { payments: "application" },
        },
      });
      accountId = account.id;
      await admin.from("partners").update({ stripe_account_id: accountId }).eq("id", partner.id);
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}${returnPath}?stripe_connect=refresh`,
      return_url: `${origin}${returnPath}?stripe_connect=success`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Stripe error";
    console.error("Stripe Connect onboard error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
