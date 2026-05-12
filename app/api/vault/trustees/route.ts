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

async function sendInviteEmail(trustee_name: string, trustee_email: string, ownerName: string, token: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const confirmUrl = `${baseUrl}/vault/trustee-confirm?token=${token}`;

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
          <p style="color: #9ca3af; font-size: 11px;">EstateVault · Protecting what matters most</p>
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

  const invite_token = randomUUID();
  const ownerName = profile?.full_name || profile?.email || user.email || "Your contact";

  // E2EE path: persist ciphertext + email_blind. invite_email/name passed
  // transiently (used once for Resend, never persisted).
  const isE2EE = !!(body.ciphertext && body.nonce && body.emailBlind);
  const inviteEmail: string | undefined = body.invite_email ?? body.trustee_email;
  const inviteName: string | undefined = body.invite_name ?? body.trustee_name;

  const insertRow: Record<string, unknown> = {
    client_id: client.id,
    status: "pending",
    invite_token,
    invite_sent_at: new Date().toISOString(),
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
    await sendInviteEmail(inviteName!, inviteEmail!, ownerName, invite_token);
  } catch (emailErr: unknown) {
    console.error("Trustee invite email failed:", emailErr);
    const msg = emailErr instanceof Error ? emailErr.message : "Email send failed";
    return NextResponse.json({ success: true, emailError: msg, encrypted: isE2EE });
  }

  return NextResponse.json({ success: true, encrypted: isE2EE });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const { token } = body;
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const admin = createAdminClient();
  const { data: trustee, error: findErr } = await admin
    .from("vault_trustees")
    .select("id, status")
    .eq("invite_token", token)
    .single();

  if (findErr || !trustee) return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  if (trustee.status === "active") return NextResponse.json({ alreadyConfirmed: true });

  const { error: updateErr } = await admin
    .from("vault_trustees")
    .update({ status: "active", confirmed_at: new Date().toISOString() })
    .eq("id", trustee.id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
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

  await admin.from("vault_trustees").delete().eq("id", id).eq("client_id", client.id);
  return NextResponse.json({ success: true });
}
