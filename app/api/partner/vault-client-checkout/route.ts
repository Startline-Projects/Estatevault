import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";
import { stripe } from "@/lib/stripe";
import bcrypt from "bcryptjs";

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user: partnerUser } } = await supabase.auth.getUser();
    if (!partnerUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { clientEmail, clientName, tempPassword, pin } = await request.json();

    if (!clientEmail || !clientName || !tempPassword || !pin) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }
    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: "PIN must be 4 digits." }, { status: 400 });
    }

    const admin = createAdminClient();
    const normalizedEmail = clientEmail.trim().toLowerCase();

    const { data: partner } = await admin
      .from("partners")
      .select("id, company_name, tier")
      .eq("profile_id", partnerUser.id)
      .single();

    if (!partner) return NextResponse.json({ error: "Partner not found." }, { status: 404 });
    if (partner.tier !== "basic") {
      return NextResponse.json({ error: "This feature is for basic tier partners only." }, { status: 403 });
    }

    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    const { data: createdUser, error: createErr } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: clientName.trim(), user_type: "client" },
    });

    if (createErr || !createdUser?.user?.id) {
      return NextResponse.json({ error: "Failed to create client account." }, { status: 500 });
    }

    const clientUserId = createdUser.user.id;

    await admin.from("profiles").upsert({
      id: clientUserId,
      email: normalizedEmail,
      full_name: clientName.trim(),
      user_type: "client",
    });

    const pinHash = await bcrypt.hash(pin, 10);
    await admin.from("profiles").update({ vault_pin_hash: pinHash }).eq("id", clientUserId);

    const { data: clientRecord } = await admin
      .from("clients")
      .insert({ profile_id: clientUserId, partner_id: partner.id, source: "partner" })
      .select("id")
      .single();

    const clientId = clientRecord?.id ?? "";

    const origin = request.headers.get("origin") || "https://www.estatevault.us";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: partnerUser.email || undefined,
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: `Vault — ${clientName.trim()}`,
            description: `Annual vault subscription for ${normalizedEmail}`,
          },
          unit_amount: 9900,
          recurring: { interval: "year" },
        },
        quantity: 1,
      }],
      success_url: `${origin}/pro/vault-clients/success?setup=1`,
      cancel_url: `${origin}/pro/vault-clients/new`,
      metadata: {
        product_type: "vault_subscription",
        client_id: clientId,
        user_id: clientUserId,
        partner_id: partner.id,
        paid_by_partner: "true",
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Partner vault client checkout error:", error);
    return NextResponse.json({ error: "Failed to create checkout session." }, { status: 500 });
  }
}
