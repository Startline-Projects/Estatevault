import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { getOrCreateUserDek } from "@/lib/api/dek";
import { deriveSubKey, INFO, zero } from "@/lib/crypto/keyManager";
import { decryptBytes } from "@/lib/crypto/aead";
import { byteaToBytes, bytesToBytea } from "@/lib/api/crypto";
import { blindIndex, normalize } from "@/lib/crypto/blindIndex";
import { apiRateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import * as auditLogRepo from "@/lib/repos/server/auditLogRepo";

export const runtime = "nodejs";

export const POST = withRoute(async (req: NextRequest) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { success } = await apiRateLimit.limit(`farewell-verify:${ip}`);
  if (!success) return fail("Too many requests", 429);

  const formData = await req.formData();
  const clientId = formData.get("clientId") as string;
  const trusteeEmail = ((formData.get("trusteeEmail") as string) || "").trim().toLowerCase();
  const certificate = formData.get("certificate") as File;

  if (!clientId || !trusteeEmail || !certificate) return fail("Missing required fields", 400);

  const validTypes = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
  if (!validTypes.includes(certificate.type)) return fail("Certificate must be PDF, JPG, or PNG", 400);
  if (certificate.size > 10 * 1024 * 1024) return fail("Certificate must be under 10MB", 400);

  const admin = createAdminClient();

  const { data: ownerClient } = await admin
    .from("clients")
    .select("id, wrapped_dek")
    .eq("id", clientId)
    .maybeSingle();
  if (!ownerClient) return fail("No trustee found with this email for this account", 404);

  const dek = await getOrCreateUserDek(admin, ownerClient);
  const indexKey = await deriveSubKey(dek, INFO.INDEX);
  const dbKey = await deriveSubKey(dek, INFO.DB);
  let emailBlindHex: string;
  try {
    emailBlindHex = bytesToBytea(blindIndex(indexKey, normalize(trusteeEmail)));
  } finally {
    zero(indexKey);
  }

  const { data: trusteeRow } = await admin
    .from("vault_trustees")
    .select("id, ciphertext, access_scope")
    .eq("client_id", clientId)
    .eq("email_blind", emailBlindHex)
    .maybeSingle();

  if (!trusteeRow) {
    zero(dbKey);
    zero(dek);
    return fail("No trustee found with this email for this account", 404);
  }

  let trusteeName = "Trustee";
  try {
    const ct = byteaToBytes(trusteeRow.ciphertext);
    if (ct.length > 0) {
      const pt = await decryptBytes(dbKey, ct);
      const m = JSON.parse(new TextDecoder().decode(pt)) as { name?: string };
      trusteeName = m.name?.trim() || trusteeName;
    }
  } catch { /* fall back to default name */ }
  finally {
    zero(dbKey);
    zero(dek);
  }

  const trustee = { id: trusteeRow.id, trustee_name: trusteeName, access_scope: trusteeRow.access_scope };

  const scope = trustee.access_scope as { categories?: string[]; documents?: boolean; farewell?: boolean } | null;
  let hasAccessibleContent = false;

  if (!scope) {
    const { data: messages } = await admin
      .from("farewell_messages").select("id").eq("client_id", clientId)
      .eq("vault_farewell_status", "locked").limit(1);
    hasAccessibleContent = !!(messages && messages.length > 0);
  } else {
    if (scope.farewell) {
      const { data: m } = await admin.from("farewell_messages").select("id")
        .eq("client_id", clientId).eq("vault_farewell_status", "locked").limit(1);
      if (m && m.length > 0) hasAccessibleContent = true;
    }
    if (!hasAccessibleContent && scope.documents) {
      const { data: d } = await admin.from("documents").select("id").eq("client_id", clientId).limit(1);
      if (d && d.length > 0) hasAccessibleContent = true;
    }
    if (!hasAccessibleContent && scope.categories && scope.categories.length > 0) {
      const { data: i } = await admin.from("vault_items").select("id")
        .eq("client_id", clientId).in("category", scope.categories).limit(1);
      if (i && i.length > 0) hasAccessibleContent = true;
    }
  }

  if (!hasAccessibleContent) return fail("No accessible content for this trustee", 404);

  const { data: existingRequest } = await admin
    .from("farewell_verification_requests")
    .select("id")
    .eq("client_id", clientId)
    .ilike("trustee_email", trusteeEmail)
    .eq("status", "pending")
    .maybeSingle();

  if (existingRequest) return fail("A verification request is already pending", 400);

  const buffer = Buffer.from(await certificate.arrayBuffer());
  const ext = certificate.name.split(".").pop() || "pdf";
  const certPath = `${clientId}/${Date.now()}.${ext}`;

  const { error: uploadErr } = await admin.storage
    .from("death-certificates")
    .upload(certPath, buffer, { contentType: certificate.type, upsert: true });

  if (uploadErr) {
    console.error("Certificate upload error:", uploadErr);
    return fail("Failed to upload certificate", 500);
  }

  const { data: verificationReq } = await admin
    .from("farewell_verification_requests")
    .insert({
      client_id: clientId,
      trustee_id: trustee.id,
      trustee_email: trusteeEmail,
      certificate_storage_path: certPath,
      status: "pending",
    })
    .select("id")
    .single();

  await admin
    .from("farewell_messages")
    .update({ vault_farewell_status: "pending_verification" })
    .eq("client_id", clientId)
    .eq("vault_farewell_status", "locked");

  try {
    await sendEmail({
      from: "EstateVault <info@estatevault.us>",
      to: "info@estatevault.us",
      subject: `Farewell Verification Request, ${trustee.trustee_name}`,
      html: `<p>A death certificate has been submitted for verification.</p><p>Trustee: ${trustee.trustee_name} (${trusteeEmail})</p><p>Client ID: ${clientId}</p><p>Please review in the admin portal.</p>`,
    });
    await sendEmail({
      from: "EstateVault <info@estatevault.us>",
      to: trusteeEmail,
      subject: "Your verification request has been received",
      html: `<div style="font-family:Inter,sans-serif;max-width:500px;margin:0 auto;padding:32px;"><h1 style="color:#1C3557;">Request Received</h1><p>Dear ${trustee.trustee_name},</p><p>Your verification request has been received. We will review the submitted documentation and notify you within 24-48 hours.</p><p style="color:#666;font-size:13px;">- EstateVault</p></div>`,
    });
  } catch (emailErr) { console.error("Verification email failed:", emailErr); }

  await auditLogRepo.insertEntry(admin, {
    action: "farewell.verification_submitted",
    resource_type: "farewell_verification_request",
    resource_id: verificationReq?.id,
    metadata: { client_id: clientId, trustee_email: trusteeEmail },
  });

  return ok({ success: true, message: "Your request has been received. We will notify you within 24-48 hours." });
});
