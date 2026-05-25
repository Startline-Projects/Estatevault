import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { requireAuth } from "@/lib/api/auth";

export const runtime = "nodejs";

// 6-digit vault app-lock PIN (server-side bcrypt). UX gate only — NOT the
// encryption key. Accepts cookie (web) or Bearer (mobile) auth.
export async function POST(request: NextRequest) {
  const auth = await requireAuth(["client"], request);
  if ("error" in auth) return auth.error;
  const { user, admin } = auth;

  const { action, pin, newPin } = await request.json();

  if (action === "check") {
    const { data: profile } = await admin.from("profiles").select("vault_pin_hash").eq("id", user.id).single();
    const hasPin = !!profile?.vault_pin_hash;
    let selfSet = false;
    if (hasPin) {
      const { data: audit } = await admin
        .from("audit_log")
        .select("id")
        .eq("actor_id", user.id)
        .in("action", ["vault.pin_created", "vault.pin_changed"])
        .limit(1);
      selfSet = !!(audit && audit.length);
    }
    return NextResponse.json({ hasPin, selfSet });
  }

  if (action === "create") {
    if (!pin || pin.length !== 6) return NextResponse.json({ error: "PIN must be 6 digits" }, { status: 400 });
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
    if (!pin || !newPin || newPin.length !== 6) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    const { data: profile } = await admin.from("profiles").select("vault_pin_hash").eq("id", user.id).single();
    if (!profile?.vault_pin_hash) return NextResponse.json({ error: "No PIN set" }, { status: 400 });
    const valid = await bcrypt.compare(pin, profile.vault_pin_hash);
    if (!valid) return NextResponse.json({ error: "Current PIN incorrect" }, { status: 401 });
    const hash = await bcrypt.hash(newPin, 10);
    await admin.from("profiles").update({ vault_pin_hash: hash }).eq("id", user.id);
    await admin.from("audit_log").insert({ actor_id: user.id, action: "vault.pin_changed", resource_type: "profile", resource_id: user.id });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
