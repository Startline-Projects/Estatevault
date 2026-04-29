export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  createAffiliateConnectAccount,
  createAffiliateAccountLink,
} from "@/lib/stripe-payouts";
import { generateAffiliateCode } from "@/lib/affiliate";
import { affiliateSignupSchema } from "@/lib/validation/schemas";

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

async function generateUniqueCode(supabase: ReturnType<typeof createAdminClient>): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = generateAffiliateCode(8);
    const { data } = await supabase
      .from("affiliates")
      .select("id")
      .eq("code", code)
      .maybeSingle();
    if (!data) return code;
  }
  throw new Error("Could not generate unique affiliate code");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = affiliateSignupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }
    const { fullName, email, password } = parsed.data;

    const supabase = createAdminClient();

    // Reject duplicate signup
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, user_type")
      .eq("email", email)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please sign in." },
        { status: 409 }
      );
    }

    // Create auth user
    const { data: newUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, user_type: "affiliate" },
    });

    if (authError || !newUser.user) {
      console.error("Affiliate signup auth error:", authError);
      return NextResponse.json(
        { error: authError?.message || "Failed to create account" },
        { status: 500 }
      );
    }

    const profileId = newUser.user.id;

    await supabase.from("profiles").upsert({
      id: profileId,
      email,
      full_name: fullName,
      user_type: "affiliate",
    });

    // Generate unique code + insert affiliate row
    const code = await generateUniqueCode(supabase);

    const { data: affiliate, error: affErr } = await supabase
      .from("affiliates")
      .insert({
        profile_id: profileId,
        code,
        full_name: fullName,
        email,
        status: "pending_onboarding",
      })
      .select("id")
      .single();

    if (affErr || !affiliate) {
      console.error("Affiliate row insert failed:", affErr);
      return NextResponse.json(
        { error: "Failed to create affiliate record" },
        { status: 500 }
      );
    }

    // Create Stripe Connect Express account
    const stripeAccount = await createAffiliateConnectAccount(email, affiliate.id);

    await supabase
      .from("affiliates")
      .update({ stripe_account_id: stripeAccount.id })
      .eq("id", affiliate.id);

    const origin = request.headers.get("origin") || "https://www.estatevault.us";
    const accountLink = await createAffiliateAccountLink(stripeAccount.id, origin);

    await supabase.from("audit_log").insert({
      actor_id: profileId,
      action: "affiliate.signup",
      resource_type: "affiliate",
      resource_id: affiliate.id,
      metadata: { code, email },
    });

    return NextResponse.json({
      affiliateId: affiliate.id,
      code,
      onboardingUrl: accountLink.url,
    });
  } catch (error) {
    console.error("Affiliate signup error:", error);
    return NextResponse.json(
      { error: "Failed to complete signup" },
      { status: 500 }
    );
  }
}
