export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { createAffiliateAccountLink } from "@/lib/stripe-payouts";
import { getAppUrl } from "@/lib/config/appUrl";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(undefined, request);
    if ("error" in auth) return auth.error;

    const { data: affiliate } = await auth.admin
      .from("affiliates")
      .select("id, stripe_account_id")
      .eq("profile_id", auth.user.id)
      .single();

    if (!affiliate?.stripe_account_id) {
      return NextResponse.json(
        { error: "Affiliate Stripe account not found" },
        { status: 404 }
      );
    }

    const origin = request.headers.get("origin") || getAppUrl();
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
