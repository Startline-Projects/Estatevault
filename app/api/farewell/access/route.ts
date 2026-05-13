import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { Resend } from "resend";
import { issueTrusteeToken, hashToken } from "@/lib/security/trusteeToken";

const resend = new Resend(process.env.RESEND_API_KEY);
const ACCESS_TTL_SECONDS = 7 * 24 * 3600;
const RESEND_COOLDOWN_MS = 60 * 1000;

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

// POST /api/farewell/access
// Trustee verifies identity and gets signed URLs for unlocked messages.
// No auth required, trustee is not a Supabase user.
export async function POST(request: Request) {
  try {
    const { clientId, trusteeEmail } = await request.json();

    if (!clientId || !trusteeEmail) {
      return NextResponse.json({ error: "Missing clientId or trusteeEmail" }, { status: 400 });
    }

    const admin = createAdminClient();

    // 1. Verify this email is a registered trustee for this client
    const { data: trustee } = await admin
      .from("vault_trustees")
      .select("id, trustee_name, status, confirmed_at, access_scope")
      .eq("client_id", clientId)
      .eq("trustee_email", trusteeEmail.toLowerCase().trim())
      .single();

    if (!trustee) {
      return NextResponse.json(
        { error: "No trustee account found for this email. Please check your email address." },
        { status: 404 }
      );
    }

    // Trustee must have accepted invite email first.
    if (!trustee.confirmed_at || trustee.status === "pending") {
      return NextResponse.json({ state: "trustee_not_confirmed" });
    }

    // 2. Per-trustee gate: must have an approved verification request (cert uploaded + admin-approved + not vetoed).
    const { data: req } = await admin
      .from("farewell_verification_requests")
      .select("id, status, vault_unlock_approved, owner_vetoed_at, certificate_storage_path, submitted_at, unlock_window_expires_at, access_expires_at, trustee_email_notified_at")
      .eq("client_id", clientId)
      .ilike("trustee_email", trusteeEmail)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!req) {
      return NextResponse.json({ state: "no_request" });
    }
    if (req.owner_vetoed_at) {
      return NextResponse.json({ state: "vetoed" });
    }
    if (req.status === "rejected") {
      return NextResponse.json({ state: "rejected" });
    }
    if (req.status !== "approved" || !req.vault_unlock_approved) {
      return NextResponse.json({ state: "pending_approval" });
    }

    // Approved → do NOT return vault content from this endpoint. Issue a fresh
    // trustee unlock token, email the sign-in link, and tell the UI to show a
    // "check your email" state. Real vault content is only accessible via the
    // /trustee/unlock OTP flow.
    const now = Date.now();
    const lastSentAt = req.trustee_email_notified_at ? new Date(req.trustee_email_notified_at).getTime() : 0;
    if (now - lastSentAt < RESEND_COOLDOWN_MS) {
      return NextResponse.json({
        state: "email_sent",
        cooldown: true,
        trusteeEmail,
      });
    }

    const token = issueTrusteeToken(req.id, trusteeEmail, ACCESS_TTL_SECONDS);
    const accessExpiresAt = new Date(now + ACCESS_TTL_SECONDS * 1000);

    await admin.from("farewell_verification_requests").update({
      trustee_access_token_hash: hashToken(token),
      access_expires_at: accessExpiresAt.toISOString(),
      trustee_email_notified_at: new Date(now).toISOString(),
    }).eq("id", req.id);

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const unlockUrl = `${baseUrl}/trustee/unlock?token=${token}`;

    try {
      await resend.emails.send({
        from: "EstateVault <info@estatevault.us>",
        to: trusteeEmail,
        subject: "Your Vault Sign-In Link",
        html: `<div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:32px;color:#2D2D2D;">
          <h1 style="color:#1C3557;">Sign In to View the Vault</h1>
          <p>You requested access to the vault associated with this email. Click the button below to verify your identity and open the vault.</p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${unlockUrl}" style="background:#C9A84C;color:#fff;text-decoration:none;padding:14px 28px;border-radius:9999px;font-weight:600;">Open Vault</a>
          </div>
          <p style="color:#6b7280;font-size:13px;">This link expires on <strong>${accessExpiresAt.toUTCString()}</strong>. You will receive a one-time code by email to confirm your identity once you open the link.</p>
          <p style="color:#9ca3af;font-size:11px;margin-top:24px;">If you didn't request this, you can ignore this email.</p>
        </div>`,
      });
    } catch (e) {
      console.error("[farewell/access] sign-in email failed:", e);
      return NextResponse.json({ error: "Failed to send sign-in email" }, { status: 500 });
    }

    await admin.from("trustee_access_audit").insert({
      trustee_id: trustee.id,
      client_id: clientId,
      request_id: req.id,
      action: "signin_email_sent",
      metadata: { trustee_email: trusteeEmail },
    });

    return NextResponse.json({
      state: "email_sent",
      trusteeEmail,
    });
  } catch (error) {
    console.error("Farewell access error:", error);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
