import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/api/auth";
import { getOrCreateUserDek } from "@/lib/api/dek";
import { deriveSubKey, INFO, zero } from "@/lib/crypto/keyManager";
import { decryptBytes } from "@/lib/crypto/aead";
import { byteaToBytes, bytesToBytea } from "@/lib/api/crypto";
import { blindIndex, normalize } from "@/lib/crypto/blindIndex";
import { apiRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { success } = await apiRateLimit.limit(`farewell-verify:${ip}`);
    if (!success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const formData = await request.formData();
    const clientId = formData.get("clientId") as string;
    const trusteeEmail = ((formData.get("trusteeEmail") as string) || "").trim().toLowerCase();
    const certificate = formData.get("certificate") as File;

    if (!clientId || !trusteeEmail || !certificate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate file type
    const validTypes = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
    if (!validTypes.includes(certificate.type)) {
      return NextResponse.json({ error: "Certificate must be PDF, JPG, or PNG" }, { status: 400 });
    }

    // Validate file size (10MB)
    if (certificate.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Certificate must be under 10MB" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Option A: trustee email is encrypted at rest; matching is done via the
    // per-user blind index (HMAC over normalized email), not plaintext.
    const { data: ownerClient } = await supabase
      .from("clients")
      .select("id, wrapped_dek")
      .eq("id", clientId)
      .maybeSingle();
    if (!ownerClient) {
      return NextResponse.json({ error: "No trustee found with this email for this account" }, { status: 404 });
    }

    const dek = await getOrCreateUserDek(supabase, ownerClient);
    const indexKey = await deriveSubKey(dek, INFO.INDEX);
    const dbKey = await deriveSubKey(dek, INFO.DB);
    let emailBlindHex: string;
    try {
      emailBlindHex = bytesToBytea(blindIndex(indexKey, normalize(trusteeEmail)));
    } finally {
      zero(indexKey);
    }

    const { data: trusteeRow } = await supabase
      .from("vault_trustees")
      .select("id, ciphertext, access_scope")
      .eq("client_id", clientId)
      .eq("email_blind", emailBlindHex)
      .maybeSingle();

    if (!trusteeRow) {
      zero(dbKey);
      zero(dek);
      return NextResponse.json({ error: "No trustee found with this email for this account" }, { status: 404 });
    }

    // Decrypt trustee name (stored in ciphertext) for notification emails.
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

    // Scope-aware availability check. If trustee has any granted scope and the
    // client has matching content, request can proceed. Legacy (null scope) =
    // full access, original "needs farewell" rule kept for that path.
    const scope = trustee.access_scope as { categories?: string[]; documents?: boolean; farewell?: boolean } | null;
    let hasAccessibleContent = false;

    if (!scope) {
      const { data: messages } = await supabase
        .from("farewell_messages").select("id").eq("client_id", clientId)
        .eq("vault_farewell_status", "locked").limit(1);
      hasAccessibleContent = !!(messages && messages.length > 0);
    } else {
      if (scope.farewell) {
        const { data: m } = await supabase.from("farewell_messages").select("id")
          .eq("client_id", clientId).eq("vault_farewell_status", "locked").limit(1);
        if (m && m.length > 0) hasAccessibleContent = true;
      }
      if (!hasAccessibleContent && scope.documents) {
        const { data: d } = await supabase.from("documents").select("id").eq("client_id", clientId).limit(1);
        if (d && d.length > 0) hasAccessibleContent = true;
      }
      if (!hasAccessibleContent && scope.categories && scope.categories.length > 0) {
        const { data: i } = await supabase.from("vault_items").select("id")
          .eq("client_id", clientId).in("category", scope.categories).limit(1);
        if (i && i.length > 0) hasAccessibleContent = true;
      }
    }

    if (!hasAccessibleContent) {
      return NextResponse.json({ error: "No accessible content for this trustee" }, { status: 404 });
    }

    // Check for existing pending request
    const { data: existingRequest } = await supabase
      .from("farewell_verification_requests")
      .select("id")
      .eq("client_id", clientId)
      .ilike("trustee_email", trusteeEmail)
      .eq("status", "pending")
      .maybeSingle();

    if (existingRequest) {
      return NextResponse.json({ error: "A verification request is already pending" }, { status: 400 });
    }

    // Upload certificate
    const buffer = Buffer.from(await certificate.arrayBuffer());
    const ext = certificate.name.split(".").pop() || "pdf";
    const certPath = `${clientId}/${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("death-certificates")
      .upload(certPath, buffer, { contentType: certificate.type, upsert: true });

    if (uploadErr) {
      console.error("Certificate upload error:", uploadErr);
      return NextResponse.json({ error: "Failed to upload certificate" }, { status: 500 });
    }

    // Create verification request
    const { data: verificationReq } = await supabase
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

    // Update farewell messages to pending_verification
    await supabase
      .from("farewell_messages")
      .update({ vault_farewell_status: "pending_verification" })
      .eq("client_id", clientId)
      .eq("vault_farewell_status", "locked");

    // Send notification to admin
    try {
      await resend.emails.send({
        from: "EstateVault <info@estatevault.us>",
        to: "info@estatevault.us",
        subject: `Farewell Verification Request, ${trustee.trustee_name}`,
        html: `<p>A death certificate has been submitted for verification.</p><p>Trustee: ${trustee.trustee_name} (${trusteeEmail})</p><p>Client ID: ${clientId}</p><p>Please review in the admin portal.</p>`,
      });
      // Confirmation to trustee
      await resend.emails.send({
        from: "EstateVault <info@estatevault.us>",
        to: trusteeEmail,
        subject: "Your verification request has been received",
        html: `<div style="font-family:Inter,sans-serif;max-width:500px;margin:0 auto;padding:32px;"><h1 style="color:#1C3557;">Request Received</h1><p>Dear ${trustee.trustee_name},</p><p>Your verification request has been received. We will review the submitted documentation and notify you within 24-48 hours.</p><p style="color:#666;font-size:13px;">- EstateVault</p></div>`,
      });
    } catch (emailErr) { console.error("Verification email failed:", emailErr); }

    // Audit log
    await supabase.from("audit_log").insert({
      action: "farewell.verification_submitted",
      resource_type: "farewell_verification_request",
      resource_id: verificationReq?.id,
      metadata: { client_id: clientId, trustee_email: trusteeEmail },
    });

    return NextResponse.json({ success: true, message: "Your request has been received. We will notify you within 24-48 hours." });
  } catch (error) {
    console.error("Farewell verify error:", error);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
