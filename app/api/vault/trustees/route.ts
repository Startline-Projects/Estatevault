import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";
import { Resend } from "resend";
import { randomUUID } from "crypto";
import { bytesToBytea } from "@/lib/api/crypto";

function createAdminClient() {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { cookies: { getAll: () => [], setAll: () => {} } });
}

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: client } = await admin.from("clients").select("id").eq("profile_id", user.id).single();
  if (!client) return NextResponse.json({ trustees: [] });

  const { data } = await admin.from("vault_trustees").select("*").eq("client_id", client.id);
  return NextResponse.json({ trustees: data || [] });
}

async function sendInviteEmail(trustee_name: string, trustee_email: string, ownerName: string, token: string, clientId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const confirmUrl = `${baseUrl}/vault/trustee-confirm?token=${token}`;
  const emergencyUrl = `${baseUrl}/farewell/${clientId}`;

  const result = await resend.emails.send({
    from: "EstateVault <info@estatevault.us>",
    to: trustee_email,
    subject: `${ownerName} added you as a Vault Trustee — confirm your role`,
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 520px; margin: 0 auto; color: #2D2D2D;">
        <div style="background: #1C3557; padding: 24px 32px; border-radius: 12px 12px 0 0;">
          <p style="color: #C9A84C; font-size: 18px; font-weight: 700; margin: 0;">EstateVault</p>
        </div>
        <div style="background: #fff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="color: #1C3557; font-size: 20px; margin-top: 0;">Hello ${trustee_name},</h2>
          <p><strong>${ownerName}</strong> has designated you as a <strong>Vault Trustee</strong> on EstateVault.</p>
          <p style="color: #6b7280; font-size: 14px;">As a trustee, you may request emergency access to their protected vault in the event of their passing or incapacity. Access is granted only after a 72-hour review and identity verification.</p>
          <p style="color: #6b7280; font-size: 14px;">Please confirm you accept this role by clicking the button below.</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${confirmUrl}" style="background: #C9A84C; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 9999px; font-weight: 600; font-size: 15px;">Accept Role as Trustee</a>
          </div>
          <p style="color: #9ca3af; font-size: 12px;">This link expires in 7 days. If you did not expect this email, you can safely ignore it.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <div style="background: #FEF3C7; border: 1px solid #FCD34D; border-radius: 12px; padding: 20px; margin-top: 16px;">
            <p style="color: #92400E; font-weight: 700; margin: 0 0 8px;">⚠ Save this email for emergencies</p>
            <p style="color: #92400E; font-size: 13px; margin: 0 0 12px;">If <strong>${ownerName}</strong> passes away or becomes incapacitated, use the link below to request emergency vault access. You will need to submit a death certificate and identification.</p>
            <p style="margin: 0;"><a href="${emergencyUrl}" style="color: #1C3557; font-weight: 600; font-size: 13px; text-decoration: underline;">Emergency Access — ${emergencyUrl}</a></p>
          </div>
          <p style="color: #9ca3af; font-size: 11px; margin-top: 16px;">EstateVault · Protecting what matters most</p>
        </div>
      </div>
    `,
  });
  if (result.error) {
    console.error("Resend send error:", result.error);
    throw new Error(result.error.message);
  }
  console.log("Resend send ok:", result.data?.id);
}

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const admin = createAdminClient();

  const { data: client } = await admin
    .from("clients")
    .select("id, vault_shamir_initialized_at, crypto_setup_at")
    .eq("profile_id", user.id)
    .single();
  if (!client) return NextResponse.json({ error: "No client record" }, { status: 400 });

  // Trustee access requires Shamir setup so we can release Share C at approval.
  if (!client.vault_shamir_initialized_at) {
    return NextResponse.json(
      {
        error: "Trustee access not initialized",
        action: "setup_shamir",
        message: client.crypto_setup_at
          ? "Initialize trustee access first (one-time, requires recovery words)."
          : "Vault must be set up before adding trustees.",
      },
      { status: 409 },
    );
  }

  const { data: profile } = await admin.from("profiles").select("full_name, email").eq("id", user.id).single();

  const { data: existing } = await admin.from("vault_trustees").select("id").eq("client_id", client.id);
  if (existing && existing.length >= 2) return NextResponse.json({ error: "Maximum 2 trustees allowed" }, { status: 400 });

  // Duplicate email check — match by email_blind (E2EE preferred) or lowercase trustee_email (legacy).
  const incomingEmail: string | undefined = (body.invite_email ?? body.trustee_email)?.trim?.().toLowerCase?.();
  const incomingBlindB64: string | undefined = body.emailBlind;
  if (incomingBlindB64) {
    const blindBytea = bytesToBytea(new Uint8Array(Buffer.from(incomingBlindB64, "base64")));
    const { data: dupBlind } = await admin
      .from("vault_trustees")
      .select("id")
      .eq("client_id", client.id)
      .eq("email_blind", blindBytea)
      .limit(1);
    if (dupBlind && dupBlind.length > 0) {
      return NextResponse.json({ error: "This trustee email is already added" }, { status: 409 });
    }
  }
  if (incomingEmail) {
    const { data: dupEmail } = await admin
      .from("vault_trustees")
      .select("id")
      .eq("client_id", client.id)
      .ilike("trustee_email", incomingEmail)
      .limit(1);
    if (dupEmail && dupEmail.length > 0) {
      return NextResponse.json({ error: "This trustee email is already added" }, { status: 409 });
    }
  }

  const invite_token = randomUUID();
  const ownerName = profile?.full_name || profile?.email || user.email || "Your contact";

  // E2EE path: persist ciphertext + email_blind. invite_email/name passed
  // transiently (used once for Resend, never persisted).
  const isE2EE = !!(body.ciphertext && body.nonce && body.emailBlind);
  const inviteEmail: string | undefined = body.invite_email ?? body.trustee_email;
  const inviteName: string | undefined = body.invite_name ?? body.trustee_name;

  const scope = body.access_scope && typeof body.access_scope === "object" ? {
    categories: Array.isArray(body.access_scope.categories) ? body.access_scope.categories.filter((c: unknown) => typeof c === "string") : [],
    documents: !!body.access_scope.documents,
    farewell: !!body.access_scope.farewell,
  } : null;

  const insertRow: Record<string, unknown> = {
    client_id: client.id,
    status: "pending",
    invite_token,
    invite_sent_at: new Date().toISOString(),
    access_scope: scope,
  };

  if (isE2EE) {
    try {
      const ct = Buffer.from(body.ciphertext, "base64");
      const nonce = Buffer.from(body.nonce, "base64");
      const emailBlind = Buffer.from(body.emailBlind, "base64");
      if (nonce.length !== 24) throw new Error("bad nonce");
      if (emailBlind.length !== 32) throw new Error("bad email_blind");
      insertRow.ciphertext = bytesToBytea(new Uint8Array(ct));
      insertRow.nonce = bytesToBytea(new Uint8Array(nonce));
      insertRow.email_blind = bytesToBytea(new Uint8Array(emailBlind));
      insertRow.enc_version = body.encVersion ?? 1;
      insertRow.trustee_name = "";
      insertRow.trustee_email = (inviteEmail || "").trim().toLowerCase();
      insertRow.trustee_relationship = "";
      insertRow.backfilled_at = new Date().toISOString();
    } catch (e) {
      return NextResponse.json({ error: `bad e2ee payload: ${(e as Error).message}` }, { status: 400 });
    }
    if (!inviteEmail || !inviteName) {
      return NextResponse.json({ error: "invite_email + invite_name required (transient, not persisted)" }, { status: 400 });
    }
  } else {
    insertRow.trustee_name = body.trustee_name;
    insertRow.trustee_email = body.trustee_email;
    insertRow.trustee_relationship = body.trustee_relationship;
  }

  const { error } = await admin.from("vault_trustees").insert(insertRow);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    await sendInviteEmail(inviteName!, inviteEmail!, ownerName, invite_token, client.id);
  } catch (emailErr: unknown) {
    console.error("Trustee invite email failed:", emailErr);
    const msg = emailErr instanceof Error ? emailErr.message : "Email send failed";
    return NextResponse.json({ success: true, emailError: msg, encrypted: isE2EE });
  }

  return NextResponse.json({ success: true, encrypted: isE2EE });
}

async function sendAcceptanceConfirmation(opts: {
  trustee_name: string;
  trustee_email: string;
  ownerName: string;
  clientId: string;
}) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const emergencyUrl = `${baseUrl}/farewell/${opts.clientId}`;
  const result = await resend.emails.send({
    from: "EstateVault <info@estatevault.us>",
    to: opts.trustee_email,
    subject: `You are now a Vault Trustee for ${opts.ownerName} — save this email`,
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 520px; margin: 0 auto; color: #2D2D2D;">
        <div style="background: #1C3557; padding: 24px 32px; border-radius: 12px 12px 0 0;">
          <p style="color: #C9A84C; font-size: 18px; font-weight: 700; margin: 0;">EstateVault</p>
        </div>
        <div style="background: #fff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="color: #1C3557; font-size: 20px; margin-top: 0;">Hello ${opts.trustee_name},</h2>
          <p>You have accepted the role of <strong>Vault Trustee</strong> for <strong>${opts.ownerName}</strong>. Thank you.</p>
          <p style="color: #6b7280; font-size: 14px;">There is nothing else for you to do right now. Please keep this email safe — it contains the link you will need in case of emergency.</p>
          <div style="background: #FEF3C7; border: 1px solid #FCD34D; border-radius: 12px; padding: 20px; margin-top: 20px;">
            <p style="color: #92400E; font-weight: 700; margin: 0 0 8px;">⚠ Emergency Access</p>
            <p style="color: #92400E; font-size: 13px; margin: 0 0 12px;">If <strong>${opts.ownerName}</strong> passes away or becomes incapacitated, visit the link below. You will be asked to submit a death certificate and identification. Vault access is granted only after a 72-hour review window.</p>
            <p style="margin: 0;"><a href="${emergencyUrl}" style="color: #1C3557; font-weight: 600; font-size: 13px; text-decoration: underline;">${emergencyUrl}</a></p>
          </div>
          <p style="color: #9ca3af; font-size: 11px; margin-top: 24px;">EstateVault · Protecting what matters most</p>
        </div>
      </div>
    `,
  });
  if (result.error) {
    console.error("Acceptance email error:", result.error);
  }
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const { token } = body;
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const admin = createAdminClient();
  const { data: trustee, error: findErr } = await admin
    .from("vault_trustees")
    .select("id, status, client_id, trustee_name, trustee_email")
    .eq("invite_token", token)
    .single();

  if (findErr || !trustee) return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  if (trustee.status === "active") return NextResponse.json({ alreadyConfirmed: true });

  const { error: updateErr } = await admin
    .from("vault_trustees")
    .update({ status: "active", confirmed_at: new Date().toISOString() })
    .eq("id", trustee.id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // Post-acceptance confirmation email with emergency URL (Option C).
  if (trustee.trustee_email) {
    try {
      const { data: clientRow } = await admin
        .from("clients").select("profile_id").eq("id", trustee.client_id).single();
      let ownerName = "your contact";
      if (clientRow?.profile_id) {
        const { data: prof } = await admin
          .from("profiles").select("full_name, email").eq("id", clientRow.profile_id).single();
        ownerName = prof?.full_name || prof?.email || ownerName;
      }
      await sendAcceptanceConfirmation({
        trustee_name: trustee.trustee_name || "there",
        trustee_email: trustee.trustee_email,
        ownerName,
        clientId: trustee.client_id,
      });
    } catch (e) {
      console.error("Acceptance confirmation send failed:", e);
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const admin = createAdminClient();
  const { data: client } = await admin.from("clients").select("id").eq("profile_id", user.id).single();
  if (!client) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Null out trustee_id on dependent rows that block delete (NO ACTION FK).
  await admin.from("farewell_verification_requests").update({ trustee_id: null }).eq("trustee_id", id);

  const { error: delErr, count } = await admin
    .from("vault_trustees")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("client_id", client.id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
  if (count === 0) return NextResponse.json({ error: "Trustee not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
