import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function createAdminClient() {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { cookies: { getAll: () => [], setAll: () => {} } });
}

export async function POST(request: Request) {
  try {
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

    // Verify trustee exists for this client
    const { data: trustee } = await supabase
      .from("vault_trustees")
      .select("id, trustee_name")
      .eq("client_id", clientId)
      .ilike("trustee_email", trusteeEmail)
      .maybeSingle();

    if (!trustee) {
      return NextResponse.json({ error: "No trustee found with this email for this account" }, { status: 404 });
    }

    // Check that client has farewell messages
    const { data: messages } = await supabase
      .from("farewell_messages")
      .select("id")
      .eq("client_id", clientId)
      .eq("vault_farewell_status", "locked")
      .limit(1);

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "No farewell messages available" }, { status: 404 });
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
    const certPath = `${clientId}/certificates/${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("farewell-videos")
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
