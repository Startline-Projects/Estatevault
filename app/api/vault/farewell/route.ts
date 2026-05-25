import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { requireClientUser, bytesToBytea, byteaToBytes } from "@/lib/api/crypto";
import { getOrCreateUserDek } from "@/lib/api/dek";
import { deriveSubKey, INFO, zero } from "@/lib/crypto/keyManager";
import { encryptBytes, decryptBytes } from "@/lib/crypto/aead";
import { blindIndex, normalize } from "@/lib/crypto/blindIndex";

export const runtime = "nodejs";

const resend = new Resend(process.env.RESEND_API_KEY);

// Option A: clients send/receive PLAINTEXT title + recipient. The server encrypts
// them at rest (EV01) and can decrypt (recoverable). The video stream key is
// served via /api/vault/file-key (F2); only its 24-byte header is stored here.

export async function GET(req: NextRequest) {
  const ctx = await requireClientUser(req, { autoCreate: true });
  if ("error" in ctx) return ctx.error;
  const { admin, client } = ctx;

  const { data: rows } = await admin
    .from("farewell_messages")
    .select("id, ciphertext, file_size_mb, duration_seconds, vault_farewell_status, created_at, updated_at, storage_path")
    .eq("client_id", client.id)
    .not("vault_farewell_status", "in", '("deleted","replaced","expired")')
    .order("created_at", { ascending: false });

  if (!rows || rows.length === 0) return NextResponse.json({ messages: [] });

  const dek = await getOrCreateUserDek(admin, client);
  const dbKey = await deriveSubKey(dek, INFO.DB);
  const messages = [];
  try {
    for (const r of rows) {
      let title = "", recipientEmail = "";
      const ct = byteaToBytes(r.ciphertext);
      if (ct.length > 0) {
        try {
          const pt = await decryptBytes(dbKey, ct);
          const meta = JSON.parse(new TextDecoder().decode(pt)) as { title: string; recipient_email: string };
          title = meta.title ?? "";
          recipientEmail = meta.recipient_email ?? "";
        } catch {
          title = "[decryption failed]";
        }
      }
      messages.push({
        id: r.id,
        title,
        recipientEmail,
        fileSizeMb: r.file_size_mb,
        durationSeconds: r.duration_seconds,
        status: r.vault_farewell_status,
        storagePath: r.storage_path,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      });
    }
  } finally {
    zero(dbKey);
    zero(dek);
  }

  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest) {
  const ctx = await requireClientUser(req, { autoCreate: true });
  if ("error" in ctx) return ctx.error;
  const { admin, user, client } = ctx;

  const { data: sub } = await admin
    .from("clients").select("vault_subscription_status").eq("id", client.id).single();
  if (sub?.vault_subscription_status !== "active") {
    return NextResponse.json({ error: "Vault subscription required" }, { status: 403 });
  }

  let body: { title?: string; recipientEmail?: string; storagePath?: string; fileSizeMb?: number; durationSeconds?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const { title, recipientEmail, storagePath } = body;
  if (!title || !recipientEmail) {
    return NextResponse.json({ error: "Title and recipient email are required" }, { status: 400 });
  }
  // storagePath is optional: clients may create the metadata-only (locked) record
  // first and attach the encrypted video later via PATCH.

  const dek = await getOrCreateUserDek(admin, client);
  const dbKey = await deriveSubKey(dek, INFO.DB);
  const indexKey = await deriveSubKey(dek, INFO.INDEX);
  let insertRow: Record<string, unknown>;
  try {
    const meta = new TextEncoder().encode(JSON.stringify({ title, recipient_email: recipientEmail }));
    const env = await encryptBytes(dbKey, meta);
    const recipientBlind = blindIndex(indexKey, normalize(recipientEmail));
    insertRow = {
      client_id: client.id,
      vault_farewell_status: "locked",
      ciphertext: bytesToBytea(env.bytes),
      nonce: bytesToBytea(env.nonce),
      recipient_blind: bytesToBytea(recipientBlind),
      storage_path: storagePath ?? null,
      enc_version: 1,
      title: "",
      recipient_email: "",
      file_size_mb: body.fileSizeMb ?? null,
      duration_seconds: body.durationSeconds ?? null,
      backfilled_at: new Date().toISOString(),
    };
  } finally {
    zero(indexKey);
    zero(dbKey);
    zero(dek);
  }

  const { data: message, error } = await admin
    .from("farewell_messages")
    .insert(insertRow)
    .select("id")
    .single();
  if (error || !message) {
    return NextResponse.json({ error: "Failed to create message" }, { status: 500 });
  }

  const { data: senderProfile } = await admin.from("profiles").select("full_name").eq("id", user.id).single();
  const senderName = senderProfile?.full_name || "Someone you know";
  const accessLink = `https://www.estatevault.us/farewell/${client.id}`;
  try {
    await resend.emails.send({
      from: "EstateVault <info@estatevault.us>",
      to: recipientEmail,
      subject: `${senderName} has left you a farewell message`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:32px;">
          <h1 style="color:#1C3557;font-size:22px;margin-bottom:8px;">A Message Has Been Prepared for You</h1>
          <p style="color:#2D2D2D;font-size:15px;line-height:1.6;"><strong>${senderName}</strong> has recorded a personal farewell message titled "<strong>${title}</strong>" and designated you as the recipient.</p>
          <p style="color:#2D2D2D;font-size:15px;line-height:1.6;">This message is securely stored and <strong>locked</strong>. It will only become accessible after a verified death certificate is submitted and reviewed by our team.</p>
          <div style="margin:24px 0;"><a href="${accessLink}" style="display:inline-block;background:#C9A84C;color:white;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:600;font-size:14px;">Access Farewell Messages</a></div>
          <p style="color:#999;font-size:12px;margin-top:16px;">- EstateVault</p>
        </div>`,
    });
  } catch (emailErr) {
    console.error("Farewell notification email failed:", emailErr);
  }

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "farewell.created",
    resource_type: "farewell_message",
    resource_id: message.id,
    metadata: { encrypted: true },
  }).then(() => undefined, () => undefined);

  return NextResponse.json({ id: message.id, messageId: message.id });
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireClientUser(req);
  if ("error" in ctx) return ctx.error;
  const { admin, user, client } = ctx;

  let body: { messageId?: string; title?: string; recipientEmail?: string; storagePath?: string; fileSizeMb?: number; durationSeconds?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const { messageId, title, recipientEmail } = body;
  if (!messageId) return NextResponse.json({ error: "Missing messageId" }, { status: 400 });

  const { data: existing } = await admin
    .from("farewell_messages")
    .select("id, vault_farewell_status, ciphertext")
    .eq("id", messageId)
    .eq("client_id", client.id)
    .single();
  if (!existing) return NextResponse.json({ error: "Message not found" }, { status: 404 });
  if (existing.vault_farewell_status === "unlocked") {
    return NextResponse.json({ error: "Cannot edit unlocked messages" }, { status: 400 });
  }

  const dek = await getOrCreateUserDek(admin, client);
  const dbKey = await deriveSubKey(dek, INFO.DB);
  const indexKey = await deriveSubKey(dek, INFO.INDEX);
  let update: Record<string, unknown>;
  try {
    let curTitle = "", curRecipient = "";
    const ct = byteaToBytes(existing.ciphertext);
    if (ct.length > 0) {
      try {
        const pt = await decryptBytes(dbKey, ct);
        const meta = JSON.parse(new TextDecoder().decode(pt)) as { title: string; recipient_email: string };
        curTitle = meta.title ?? "";
        curRecipient = meta.recipient_email ?? "";
      } catch { /* re-encrypt fresh */ }
    }
    const newTitle = title ?? curTitle;
    const newRecipient = recipientEmail ?? curRecipient;
    const env = await encryptBytes(dbKey, new TextEncoder().encode(JSON.stringify({ title: newTitle, recipient_email: newRecipient })));
    update = {
      updated_at: new Date().toISOString(),
      ciphertext: bytesToBytea(env.bytes),
      nonce: bytesToBytea(env.nonce),
      recipient_blind: bytesToBytea(blindIndex(indexKey, normalize(newRecipient))),
    };
  } finally {
    zero(indexKey);
    zero(dbKey);
    zero(dek);
  }

  // Attach video (or update its metadata) — no crypto needed.
  if (body.storagePath !== undefined) update.storage_path = body.storagePath;
  if (body.fileSizeMb !== undefined) update.file_size_mb = body.fileSizeMb;
  if (body.durationSeconds !== undefined) update.duration_seconds = body.durationSeconds;

  await admin.from("farewell_messages").update(update).eq("id", messageId);
  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: recipientEmail ? "farewell.recipient_updated" : "farewell.updated",
    resource_type: "farewell_message",
    resource_id: messageId,
  }).then(() => undefined, () => undefined);

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const ctx = await requireClientUser(req);
  if ("error" in ctx) return ctx.error;
  const { admin, user, client } = ctx;

  let body: { messageId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const { messageId } = body;
  if (!messageId) return NextResponse.json({ error: "Missing messageId" }, { status: 400 });

  const { data: existing } = await admin
    .from("farewell_messages")
    .select("id, vault_farewell_status, storage_path")
    .eq("id", messageId)
    .eq("client_id", client.id)
    .single();
  if (!existing) return NextResponse.json({ error: "Message not found" }, { status: 404 });
  if (existing.vault_farewell_status === "unlocked") {
    return NextResponse.json({ error: "Cannot delete unlocked messages" }, { status: 400 });
  }

  if (existing.storage_path) {
    await admin.storage.from("farewell-videos").remove([existing.storage_path]);
  }
  await admin.from("farewell_messages").update({
    vault_farewell_status: "deleted",
    deleted_at: new Date().toISOString(),
    storage_path: null,
  }).eq("id", messageId);
  await admin.from("farewell_verification_requests")
    .update({ status: "rejected", notes: "Message deleted by owner" })
    .eq("client_id", client.id)
    .eq("status", "pending");
  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "farewell.owner_deleted",
    resource_type: "farewell_message",
    resource_id: messageId,
  }).then(() => undefined, () => undefined);

  return NextResponse.json({ success: true });
}
