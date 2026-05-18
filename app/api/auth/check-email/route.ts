import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const dynamic = "force-dynamic";

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: profile } = await admin
      .from("profiles")
      .select("id, full_name")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ exists: false });
    }

    const { data: client } = await admin
      .from("clients")
      .select("id, vault_subscription_status")
      .eq("profile_id", profile.id)
      .maybeSingle();

    const hasVault = client?.vault_subscription_status === "active";

    let hasWill = false;
    let hasTrust = false;
    if (client?.id) {
      const { data: orders } = await admin
        .from("orders")
        .select("product_type")
        .eq("client_id", client.id);
      hasWill = !!orders?.some((o) => o.product_type === "will");
      hasTrust = !!orders?.some((o) => o.product_type === "trust");
    }

    return NextResponse.json({
      exists: true,
      fullName: profile.full_name || null,
      hasWill,
      hasTrust,
      hasVault,
    });
  } catch (err) {
    console.error("check-email error:", err);
    return NextResponse.json({ error: "Failed to check email." }, { status: 500 });
  }
}
