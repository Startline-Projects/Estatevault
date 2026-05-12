import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { createServerClient } from "@supabase/ssr";
import { Resend } from "resend";
import { verifyVetoToken } from "@/lib/security/vetoToken";

export const runtime = "nodejs";

const resend = new Resend(process.env.RESEND_API_KEY);

function admin() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

function hashToken(t: string) {
  return createHash("sha256").update(t).digest("hex");
}

// GET — preview: confirms token is valid and returns minimal info for the page.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) return NextResponse.json({ ok: false, error: "missing token" }, { status: 400 });

  const v = verifyVetoToken(token);
  if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 400 });

  const db = admin();
  const { data: reqRow } = await db
    .from("farewell_verification_requests")
    .select("id, client_id, status, vault_unlock_approved, unlock_window_expires_at, owner_vetoed_at, owner_veto_token_hash")
    .eq("id", v.requestId)
    .single();

  if (!reqRow) return NextResponse.json({ ok: false, error: "request not found" }, { status: 404 });
  if (reqRow.owner_veto_token_hash !== hashToken(token)) {
    return NextResponse.json({ ok: false, error: "token mismatch" }, { status: 400 });
  }
  if (reqRow.owner_vetoed_at) return NextResponse.json({ ok: false, alreadyVetoed: true });
  if (!reqRow.vault_unlock_approved) return NextResponse.json({ ok: false, error: "not in unlock window" }, { status: 400 });

  return NextResponse.json({
    ok: true,
    requestId: reqRow.id,
    expiresAt: reqRow.unlock_window_expires_at,
  });
}

// POST — actually veto.
export async function POST(req: Request) {
  let body: { token?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const token = body.token;
  if (!token) return NextResponse.json({ error: "missing token" }, { status: 400 });

  const v = verifyVetoToken(token);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const db = admin();
  const { data: reqRow } = await db
    .from("farewell_verification_requests")
    .select("id, client_id, trustee_email, status, vault_unlock_approved, owner_vetoed_at, owner_veto_token_hash")
    .eq("id", v.requestId)
    .single();

  if (!reqRow) return NextResponse.json({ error: "request not found" }, { status: 404 });
  if (reqRow.owner_veto_token_hash !== hashToken(token)) {
    return NextResponse.json({ error: "token mismatch" }, { status: 400 });
  }
  if (reqRow.owner_vetoed_at) return NextResponse.json({ ok: true, alreadyVetoed: true });
  if (!reqRow.vault_unlock_approved) return NextResponse.json({ error: "not in unlock window" }, { status: 400 });

  const now = new Date().toISOString();
  await db.from("farewell_verification_requests").update({
    owner_vetoed_at: now,
    status: "rejected",
    vault_unlock_approved: false,
    owner_veto_token_hash: null,        // burn token
    share_c_hash: null,
    trustee_access_token_hash: null,
    access_expires_at: null,
  }).eq("id", reqRow.id);

  // Revert farewell messages to locked.
  await db.from("farewell_messages").update({ vault_farewell_status: "locked" })
    .eq("client_id", reqRow.client_id)
    .in("vault_farewell_status", ["pending_verification", "unlocked"]);

  await db.from("audit_log").insert({
    action: "farewell.owner_vetoed",
    resource_type: "farewell_verification_request",
    resource_id: reqRow.id,
    metadata: { client_id: reqRow.client_id, trustee_email: reqRow.trustee_email },
  });

  // Notify trustee politely.
  try {
    if (reqRow.trustee_email) {
      await resend.emails.send({
        from: "EstateVault <info@estatevault.us>",
        to: reqRow.trustee_email,
        subject: "Vault access request cancelled",
        html: `<div style="font-family:Inter,sans-serif;max-width:500px;margin:0 auto;padding:32px;color:#2D2D2D;"><h1 style="color:#1C3557;">Request Cancelled</h1><p>The vault access request has been cancelled by the account owner. No further action is needed.</p><p style="color:#9ca3af;font-size:11px;margin-top:24px;">EstateVault</p></div>`,
      });
    }
  } catch (e) { console.error("[veto] trustee notify failed:", e); }

  return NextResponse.json({ ok: true });
}
