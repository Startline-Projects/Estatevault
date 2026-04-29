export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAffiliateAccountLink } from "@/lib/stripe-payouts";

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: affiliate } = await supabase
      .from("affiliates")
      .select("id, stripe_account_id")
      .eq("profile_id", user.id)
      .single();

    if (!affiliate?.stripe_account_id) {
      return NextResponse.json(
        { error: "Affiliate Stripe account not found" },
        { status: 404 }
      );
    }

    const origin = request.headers.get("origin") || "https://www.estatevault.us";
    const link = await createAffiliateAccountLink(affiliate.stripe_account_id, origin);

    return NextResponse.json({ onboardingUrl: link.url });
  } catch (error) {
    console.error("Affiliate onboarding refresh error:", error);
    return NextResponse.json(
      { error: "Failed to create onboarding link" },
      { status: 500 }
    );
  }
}
