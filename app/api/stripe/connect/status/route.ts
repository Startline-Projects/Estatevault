import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";

function createAdminClient() {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { cookies: { getAll: () => [], setAll: () => {} } });
}

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const { data: partner } = await admin.from("partners").select("stripe_account_id").eq("profile_id", user.id).single();
  if (!partner?.stripe_account_id) return NextResponse.json({ connected: false });

  try {
    const account = await stripe.accounts.retrieve(partner.stripe_account_id);
    const ready = account.details_submitted && account.charges_enabled;
    return NextResponse.json({ connected: true, ready, account_id: partner.stripe_account_id });
  } catch {
    return NextResponse.json({ connected: false });
  }
}
