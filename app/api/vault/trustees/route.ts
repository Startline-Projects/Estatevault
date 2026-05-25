import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { randomUUID } from "crypto";
import { requireClientUser, bytesToBytea, byteaToBytes } from "@/lib/api/crypto";
import { createAdminClient } from "@/lib/api/auth";
import { getOrCreateUserDek } from "@/lib/api/dek";
import { deriveSubKey, INFO, zero } from "@/lib/crypto/keyManager";
import { encryptBytes, decryptBytes } from "@/lib/crypto/aead";
import { blindIndex, normalize } from "@/lib/crypto/blindIndex";

export const runtime = "nodejs";

const resend = new Resend(process.env.RESEND_API_KEY);

// Option A: trustee name/email/relationship are encrypted at rest (server holds
// the key, can decrypt — e.g. to send the acceptance email). No Shamir gate;
// heir access is a server-side grant.

type Scope = { categories: string[]; documents: boolean; farewell: boolean };
function parseScope(s: unknown): Scope | null {
  if (!s || typeof s !== "object") return null;
  const o = s as Record<string, unknown>;
  return {
    categories: Array.isArray(o.categories) ? (o.categories as unknown[]).filter((c) => typeof c === "string") as string[] : [],
    documents: !!o.documents,
    farewell: !!o.farewell,
  };
}

export async function GET(req: NextRequest) {
  const ctx = await requireClientUser(req, { autoCreate: true });
  if ("error" in ctx) return ctx.error;
  const { admin, client } = ctx;

  const { data: rows } = await admin
    .from("vault_trustees")
    .select("id, ciphertext, status, invite_sent_at, confirmed_at, access_scope")
    .eq("client_id", client.id);

  if (!rows || rows.length === 0) return NextResponse.json({ trustees: [] });

  const dek = await getOrCreateUserDek(admin, client);
  const dbKey = await deriveSubKey(dek, INFO.DB);
  const trustees = [];
  try {
    for (const r of rows) {
      let name = "", email = "", relationship = "";
      const ct = byteaToBytes(r.ciphertext);
      if (ct.length > 0) {
        try {
          const pt = await decryptBytes(dbKey, ct);
          const m = JSON.parse(new TextDecoder().decode(pt)) as { name: string; email: string; relationship: string };
          name = m.name ?? ""; email = m.email ?? ""; relationship = m.relationship ?? "";
        } catch { name = "[decryption failed]"; }
      }
      trustees.push({
        id: r.id, name, email, relationship,
        status: r.status,
        invite_sent_at: r.invite_sent_at,
        confirmed_at: r.confirmed_at,
        access_scope: r.access_scope,
      });
    }
  } finally {
    zero(dbKey);
    zero(dek);
  }

  return NextResponse.json({ trustees });
}

export async function POST(req: NextRequest) {
  const ctx = await requireClientUser(req, { autoCreate: true });
  if ("error" in ctx) return ctx.error;
  const { admin, user, client } = ctx;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }

  const name = String(body.name ?? body.trustee_name ?? "").trim();
  const email = String(body.email ?? body.trustee_email ?? "").trim();
  const relationship = String(body.relationship ?? body.trustee_relationship ?? "").trim();
  if (!name || !email) return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  const scope = parseScope(body.access_scope ?? body.accessScope);

  const { data: existing } = await admin.from("vault_trustees").select("id").eq("client_id", client.id);
  if (existing && existing.length >= 2) return NextResponse.json({ error: "Maximum 2 trustees allowed" }, { status: 400 });

  const { data: profile } = await admin.from("profiles").select("full_name, email").eq("id", user.id).single();
  const ownerName = profile?.full_name || profile?.email || user.email || "Your contact";
  const inviteToken = randomUUID();

  const dek = await getOrCreateUserDek(admin, client);
  const dbKey = await deriveSubKey(dek, INFO.DB);
  const indexKey = await deriveSubKey(dek, INFO.INDEX);
  let insertRow: Record<string, unknown>;
  let emailBlindHex: string;
  try {
    emailBlindHex = bytesToBytea(blindIndex(indexKey, normalize(email)));
    // Duplicate check by blind index.
    const { data: dup } = await admin
      .from("vault_trustees").select("id").eq("client_id", client.id).eq("email_blind", emailBlindHex).limit(1);
    if (dup && dup.length > 0) {
      return NextResponse.json({ error: "This trustee email is already added" }, { status: 409 });
    }
    const meta = new TextEncoder().encode(JSON.stringify({ name, email, relationship }));
    const env = await encryptBytes(dbKey, meta);
    insertRow = {
      client_id: client.id,
      status: "pending",
      invite_token: inviteToken,
      invite_sent_at: new Date().toISOString(),
      access_scope: scope,
      ciphertext: bytesToBytea(env.bytes),
      nonce: bytesToBytea(env.nonce),
      email_blind: emailBlindHex,
      enc_version: 1,
      trustee_name: "",
      trustee_email: "",
      trustee_relationship: "",
      backfilled_at: new Date().toISOString(),
    };
  } finally {
    zero(indexKey);
    zero(dbKey);
    zero(dek);
  }

  const { error } = await admin.from("vault_trustees").insert(insertRow);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    await sendInviteEmail(name, email, ownerName, inviteToken, client.id);
  } catch (emailErr) {
    const msg = emailErr instanceof Error ? emailErr.message : "Email send failed";
    return NextResponse.json({ success: true, emailError: msg, encrypted: true });
  }

  return NextResponse.json({ success: true, encrypted: true });
}

export async function PATCH(request: NextRequest) {
  let body: { token?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const token = body.token;
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const admin = createAdminClient();
  const { data: trustee, error: findErr } = await admin
    .from("vault_trustees")
    .select("id, status, client_id, ciphertext")
    .eq("invite_token", token)
    .single();
  if (findErr || !trustee) return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  if (trustee.status === "active") return NextResponse.json({ alreadyConfirmed: true });

  const { error: updateErr } = await admin
    .from("vault_trustees")
    .update({ status: "active", confirmed_at: new Date().toISOString() })
    .eq("id", trustee.id);
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // Acceptance email — decrypt trustee name/email using the OWNER's DEK
  // (server holds the keys under Option A).
  try {
    const { data: ownerClient } = await admin.from("clients").select("id, wrapped_dek, profile_id").eq("id", trustee.client_id).single();
    if (ownerClient) {
      let trusteeName = "there", trusteeEmail = "";
      const dek = await getOrCreateUserDek(admin, ownerClient);
      const dbKey = await deriveSubKey(dek, INFO.DB);
      try {
        const ct = byteaToBytes(trustee.ciphertext);
        if (ct.length > 0) {
          const pt = await decryptBytes(dbKey, ct);
          const m = JSON.parse(new TextDecoder().decode(pt)) as { name: string; email: string };
          trusteeName = m.name || "there";
          trusteeEmail = m.email || "";
        }
      } finally { zero(dbKey); zero(dek); }

      if (trusteeEmail) {
        let ownerName = "your contact";
        if (ownerClient.profile_id) {
          const { data: prof } = await admin.from("profiles").select("full_name, email").eq("id", ownerClient.profile_id).single();
          ownerName = prof?.full_name || prof?.email || ownerName;
        }
        await sendAcceptanceConfirmation({ trustee_name: trusteeName, trustee_email: trusteeEmail, ownerName, clientId: trustee.client_id });
      }
    }
  } catch (e) {
    console.error("Acceptance confirmation send failed:", e);
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const ctx = await requireClientUser(req);
  if ("error" in ctx) return ctx.error;
  const { admin, client } = ctx;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

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
          <div style="text-align: center; margin: 32px 0;">
            <a href="${confirmUrl}" style="background: #C9A84C; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 9999px; font-weight: 600; font-size: 15px;">Accept Role as Trustee</a>
          </div>
          <p style="color: #9ca3af; font-size: 12px;">This link expires in 7 days. If you did not expect this email, you can safely ignore it.</p>
          <div style="background: #FEF3C7; border: 1px solid #FCD34D; border-radius: 12px; padding: 20px; margin-top: 16px;">
            <p style="color: #92400E; font-weight: 700; margin: 0 0 8px;">⚠ Save this email for emergencies</p>
            <p style="color: #92400E; font-size: 13px; margin: 0 0 12px;">If <strong>${ownerName}</strong> passes away or becomes incapacitated, use the link below to request emergency vault access.</p>
            <p style="margin: 0;"><a href="${emergencyUrl}" style="color: #1C3557; font-weight: 600; font-size: 13px; text-decoration: underline;">Emergency Access — ${emergencyUrl}</a></p>
          </div>
        </div>
      </div>`,
  });
  if (result.error) {
    console.error("Resend send error:", result.error);
    throw new Error(result.error.message);
  }
}

async function sendAcceptanceConfirmation(opts: { trustee_name: string; trustee_email: string; ownerName: string; clientId: string }) {
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
          <div style="background: #FEF3C7; border: 1px solid #FCD34D; border-radius: 12px; padding: 20px; margin-top: 20px;">
            <p style="color: #92400E; font-weight: 700; margin: 0 0 8px;">⚠ Emergency Access</p>
            <p style="color: #92400E; font-size: 13px; margin: 0 0 12px;">If <strong>${opts.ownerName}</strong> passes away or becomes incapacitated, visit the link below. You will be asked to submit a death certificate and identification.</p>
            <p style="margin: 0;"><a href="${emergencyUrl}" style="color: #1C3557; font-weight: 600; font-size: 13px; text-decoration: underline;">${emergencyUrl}</a></p>
          </div>
        </div>
      </div>`,
  });
  if (result.error) console.error("Acceptance email error:", result.error);
}
