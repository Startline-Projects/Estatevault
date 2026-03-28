import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";
import {
  createStripeConnectAccount,
  createAccountLink,
  getAccountStatus,
} from "@/lib/stripe-payouts";

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    }
  );
}

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get partner record for the authenticated user
    const admin = createAdminClient();
    const { data: partner, error: partnerError } = await admin
      .from("partners")
      .select("id, stripe_account_id, contact_email")
      .eq("profile_id", user.id)
      .single();

    if (partnerError || !partner) {
      return NextResponse.json(
        { error: "Partner profile not found" },
        { status: 404 }
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      request.headers.get("origin") ||
      "https://pro.estatevault.com";

    // If partner already has a Stripe account, just create a new account link
    if (partner.stripe_account_id) {
      const accountLink = await createAccountLink(
        partner.stripe_account_id,
        baseUrl
      );
      return NextResponse.json({
        url: accountLink.url,
        account_id: partner.stripe_account_id,
      });
    }

    // Create a new Stripe Express account
    const email = partner.contact_email || user.email || "";
    const account = await createStripeConnectAccount(email, partner.id);

    // Save the Stripe account ID to the partners table
    const { error: updateError } = await admin
      .from("partners")
      .update({ stripe_account_id: account.id })
      .eq("id", partner.id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to save Stripe account" },
        { status: 500 }
      );
    }

    // Create account link for onboarding
    const accountLink = await createAccountLink(account.id, baseUrl);

    return NextResponse.json({
      url: accountLink.url,
      account_id: account.id,
    });
  } catch (error) {
    console.error("Stripe Connect error:", error);
    return NextResponse.json(
      { error: "Failed to create Stripe Connect account" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: partner, error: partnerError } = await admin
      .from("partners")
      .select("id, stripe_account_id")
      .eq("profile_id", user.id)
      .single();

    if (partnerError || !partner) {
      return NextResponse.json(
        { error: "Partner profile not found" },
        { status: 404 }
      );
    }

    if (!partner.stripe_account_id) {
      return NextResponse.json({
        connected: false,
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
      });
    }

    const status = await getAccountStatus(partner.stripe_account_id);

    return NextResponse.json({
      connected: true,
      ...status,
    });
  } catch (error) {
    console.error("Stripe Connect status error:", error);
    return NextResponse.json(
      { error: "Failed to check account status" },
      { status: 500 }
    );
  }
}
