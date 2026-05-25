import { NextRequest } from "next/server";
import { Resend } from "resend";
import { randomUUID } from "crypto";
import { requireClientUser, bytesToBytea, byteaToBytes } from "@/lib/api/crypto";
import { createAdminClient } from "@/lib/api/auth";
import { getOrCreateUserDek } from "@/lib/api/dek";
import { deriveSubKey, INFO, zero } from "@/lib/crypto/keyManager";
import { encryptBytes, decryptBytes } from "@/lib/crypto/aead";
import { blindIndex, normalize } from "@/lib/crypto/blindIndex";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import * as trusteeRepo from "@/lib/repos/server/trusteeRepo";
import * as clientRepo from "@/lib/repos/server/clientRepo";
import { trusteeCreateSchema, trusteeConfirmSchema } from "@/lib/validation/schemas";

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

export const GET = withRoute(async (req: NextRequest) => {
  const ctx = await requireClientUser(req, { autoCreate: true });
  if ("error" in ctx) return ctx.error;
  const { admin, client } = ctx;

  const { data: rows, error: listErr } = await trusteeRepo.listByClient(admin, client.id);

  if (listErr) {
    console.error("[vault/trustees GET]", listErr);
    return fail("could not load trustees", 500);
  }
  if (!rows || rows.length === 0) return ok({ trustees: [] });

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

  return ok({ trustees });
});

export const POST = withRoute(async (req: NextRequest) => {
  const ctx = await requireClientUser(req, { autoCreate: true });
  if ("error" in ctx) return ctx.error;
  const { admin, user, client } = ctx;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return fail("bad json", 400); }

  // Coalesce the legacy `trustee_*` aliases, then validate (adds email-format).
  const name = String(body.name ?? body.trustee_name ?? "").trim();
  const email = String(body.email ?? body.trustee_email ?? "").trim();
  const relationship = String(body.relationship ?? body.trustee_relationship ?? "").trim();
  const parsed = trusteeCreateSchema.safeParse({ name, email, relationship });
  if (!parsed.success) return fail("invalid input", 400, { details: parsed.error.flatten() });
  const scope = parseScope(body.access_scope ?? body.accessScope);

  const { data: existing } = await trusteeRepo.listIdsByClient(admin, client.id);
  if (existing && existing.length >= 2) return fail("Maximum 2 trustees allowed", 400);

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
    const { data: dup } = await trusteeRepo.findByEmailBlind(admin, client.id, emailBlindHex);
    if (dup && dup.length > 0) {
      return fail("This trustee email is already added", 409);
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

  const { error } = await trusteeRepo.insert(admin, insertRow);
  if (error) {
    console.error("[vault/trustees POST]", error);
    return fail("could not add trustee", 500);
  }

  try {
    await sendInviteEmail(name, email, ownerName, inviteToken, client.id);
  } catch (emailErr) {
    const msg = emailErr instanceof Error ? emailErr.message : "Email send failed";
    return ok({ success: true, emailError: msg, encrypted: true });
  }

  return ok({ success: true, encrypted: true });
});

export const PATCH = withRoute(async (request: NextRequest) => {
  let raw: unknown;
  try { raw = await request.json(); } catch { return fail("bad json", 400); }
  const parsed = trusteeConfirmSchema.safeParse(raw);
  if (!parsed.success) return fail("Missing token", 400);
  const { token } = parsed.data;

  const admin = createAdminClient();
  const { data: trustee, error: findErr } = await trusteeRepo.findByInviteToken(admin, token);
  if (findErr || !trustee) return fail("Invalid or expired link", 404);
  if (trustee.status === "active") return ok({ alreadyConfirmed: true });

  const { error: updateErr } = await trusteeRepo.markActive(admin, trustee.id);
  if (updateErr) {
    console.error("[vault/trustees PATCH]", updateErr);
    return fail("could not confirm trustee", 500);
  }

  // Acceptance email — decrypt trustee name/email using the OWNER's DEK
  // (server holds the keys under Option A).
  try {
    const { data: ownerClient } = await clientRepo.getKeyMaterialById(admin, trustee.client_id);
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

  return ok({ success: true });
});

export const DELETE = withRoute(async (req: NextRequest) => {
  const ctx = await requireClientUser(req);
  if ("error" in ctx) return ctx.error;
  const { admin, client } = ctx;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return fail("Missing id", 400);

  await admin.from("farewell_verification_requests").update({ trustee_id: null }).eq("trustee_id", id);
  const { error: delErr, count } = await trusteeRepo.deleteForOwner(admin, id, client.id);
  if (delErr) {
    console.error("[vault/trustees DELETE]", delErr);
    return fail("could not remove trustee", 500);
  }
  if (count === 0) return fail("Trustee not found", 404);
  return ok({ success: true });
});

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
