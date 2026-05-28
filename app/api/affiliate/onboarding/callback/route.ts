export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/api/auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const accountId = url.searchParams.get("account");
  const origin = `${url.protocol}//${url.host}`;

  if (!accountId) {
    return NextResponse.redirect(`${origin}/affiliate-signup?error=missing_account`);
  }

  try {
    const account = await stripe.accounts.retrieve(accountId);
    const supabase = createAdminClient();

    const onboardingComplete =
      account.details_submitted && account.charges_enabled !== false;

    const { data: affiliate } = await supabase
      .from("affiliates")
      .select("id, profile_id, code")
      .eq("stripe_account_id", accountId)
      .single();

    if (!affiliate) {
      return NextResponse.redirect(`${origin}/affiliate-signup?error=not_found`);
    }

    await supabase
      .from("affiliates")
      .update({
        stripe_onboarding_complete: onboardingComplete,
        status: onboardingComplete ? "active" : "pending_onboarding",
      })
      .eq("id", affiliate.id);

    await supabase.from("audit_log").insert({
      actor_id: affiliate.profile_id,
      action: "affiliate.stripe_onboarded",
      resource_type: "affiliate",
      resource_id: affiliate.id,
      metadata: {
        complete: onboardingComplete,
        details_submitted: account.details_submitted,
      },
    });

    if (onboardingComplete) {
      return NextResponse.redirect(`${origin}/affiliate-signup?step=success&code=${affiliate.code}`);
    }
    return NextResponse.redirect(`${origin}/affiliate-signup?step=stripe&incomplete=true`);
  } catch (error) {
    console.error("Affiliate onboarding callback error:", error);
    return NextResponse.redirect(`${origin}/affiliate-signup?error=stripe_error`);
  }
}
