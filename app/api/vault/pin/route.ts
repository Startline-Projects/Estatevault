import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";
import bcrypt from "bcryptjs";

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

// Create or verify PIN
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action, pin, newPin } = await request.json();
  const admin = createAdminClient();

  if (action === "check") {
    const { data: profile } = await admin.from("profiles").select("vault_pin_hash").eq("id", user.id).single();
    return NextResponse.json({ hasPin: !!profile?.vault_pin_hash });
  }

  if (action === "create") {
    if (!pin || pin.length !== 4) return NextResponse.json({ error: "PIN must be 4 digits" }, { status: 400 });
    const hash = await bcrypt.hash(pin, 10);
    await admin.from("profiles").update({ vault_pin_hash: hash }).eq("id", user.id);
    await admin.from("audit_log").insert({ actor_id: user.id, action: "vault.pin_created", resource_type: "profile", resource_id: user.id });
    return NextResponse.json({ success: true });
  }

  if (action === "verify") {
    if (!pin) return NextResponse.json({ error: "PIN required" }, { status: 400 });
    const { data: profile } = await admin.from("profiles").select("vault_pin_hash").eq("id", user.id).single();
    if (!profile?.vault_pin_hash) return NextResponse.json({ error: "No PIN set" }, { status: 400 });
    const valid = await bcrypt.compare(pin, profile.vault_pin_hash);
    if (!valid) return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
    await admin.from("audit_log").insert({ actor_id: user.id, action: "vault.accessed", resource_type: "profile", resource_id: user.id });
    return NextResponse.json({ success: true });
  }

  if (action === "change") {
    if (!pin || !newPin || newPin.length !== 4) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    const { data: profile } = await admin.from("profiles").select("vault_pin_hash").eq("id", user.id).single();
    if (!profile?.vault_pin_hash) return NextResponse.json({ error: "No PIN set" }, { status: 400 });
    const valid = await bcrypt.compare(pin, profile.vault_pin_hash);
    if (!valid) return NextResponse.json({ error: "Current PIN incorrect" }, { status: 401 });
    const hash = await bcrypt.hash(newPin, 10);
    await admin.from("profiles").update({ vault_pin_hash: hash }).eq("id", user.id);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
