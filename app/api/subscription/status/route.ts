import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: client } = await supabase
      .from("clients")
      .select("vault_subscription_status, vault_subscription_expiry")
      .eq("profile_id", user.id)
      .single();

    if (!client) {
      return NextResponse.json({
        status: "none",
        expiry: null,
        canAmendFree: false,
        canUseFarewell: false,
      });
    }

    const isActive = client.vault_subscription_status === "active";

    return NextResponse.json({
      status: client.vault_subscription_status || "none",
      expiry: client.vault_subscription_expiry,
      canAmendFree: isActive,
      canUseFarewell: isActive,
    });
  } catch (error) {
    console.error("Subscription status error:", error);
    return NextResponse.json({ error: "Failed to check status" }, { status: 500 });
  }
}
