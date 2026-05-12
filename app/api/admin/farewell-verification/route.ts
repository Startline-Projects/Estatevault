import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";
import { Resend } from "resend";
import { issueVetoToken } from "@/lib/security/vetoToken";

const resend = new Resend(process.env.RESEND_API_KEY);
const VAULT_UNLOCK_WINDOW_HOURS = 72;

function hashToken(t: string): string {
  return createHash("sha256").update(t).digest("hex");
}

function createAdminClient() {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { cookies: { getAll: () => [], setAll: () => {} } });
}

export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    const { data: profile } = await admin.from("profiles").select("user_type").eq("id", user.id).single();
    if (!profile || profile.user_type !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { data: requests } = await admin
      .from("farewell_verification_requests")
      .select("id, client_id, trustee_id, trustee_email, certificate_storage_path, status, submitted_at, reviewed_at, notes")
      .eq("status", "pending")
      .order("submitted_at", { ascending: true });

    // Enrich with client and trustee names
    const enriched = await Promise.all((requests || []).map(async (req) => {
      const { data: client } = await admin
        .from("clients")
        .select("profile_id")
        .eq("id", req.client_id)
        .single();

      let clientName = "Unknown";
      if (client?.profile_id) {
        const { data: prof } = await admin.from("profiles").select("full_name").eq("id", client.profile_id).single();
        clientName = prof?.full_name || "Unknown";
      }

      const { data: trustee } = await admin
        .from("vault_trustees")
        .select("trustee_name")
        .eq("id", req.trustee_id)
        .single();

      // Generate signed URL for certificate
      const { data: certUrl } = await admin.storage
        .from("farewell-videos")
        .createSignedUrl(req.certificate_storage_path, 3600);

      return {
        ...req,
        client_name: clientName,
        trustee_name: trustee?.trustee_name || "Unknown",
        certificate_url: certUrl?.signedUrl || null,
      };
    }));

    return NextResponse.json({ requests: enriched });
  } catch (error) {
    console.error("Farewell verification list error:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    const { data: profile } = await admin.from("profiles").select("user_type").eq("id", user.id).single();
    if (!profile || profile.user_type !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { requestId, action, notes } = await request.json();
    if (!requestId || !action) {
      return NextResponse.json({ error: "Missing requestId or action" }, { status: 400 });
    }

    const { data: verReq } = await admin
      .from("farewell_verification_requests")
      .select("id, client_id, trustee_email, status")
      .eq("id", requestId)
      .single();

    if (!verReq) return NextResponse.json({ error: "Request not found" }, { status: 404 });
    if (verReq.status !== "pending") return NextResponse.json({ error: "Request already processed" }, { status: 400 });

    if (action === "approve") {
      // 72h vault-unlock window + owner-veto token.
      const now = new Date();
      const expiresAt = new Date(now.getTime() + VAULT_UNLOCK_WINDOW_HOURS * 3600 * 1000);
      const vetoToken = issueVetoToken(requestId, VAULT_UNLOCK_WINDOW_HOURS * 3600);
      const vetoTokenHash = hashToken(vetoToken);

      await admin.from("farewell_verification_requests").update({
        status: "approved",
        reviewed_at: now.toISOString(),
        reviewed_by: user.id,
        notes: notes || null,
        vault_unlock_approved: true,
        unlock_window_started_at: now.toISOString(),
        unlock_window_expires_at: expiresAt.toISOString(),
        owner_veto_token_hash: vetoTokenHash,
      }).eq("id", requestId);

      // Email owner: dead-man-switch veto link.
      try {
        const { data: ownerClient } = await admin
          .from("clients")
          .select("profile_id")
          .eq("id", verReq.client_id)
          .single();
        if (ownerClient?.profile_id) {
          const { data: ownerProfile } = await admin
            .from("profiles")
            .select("email, full_name")
            .eq("id", ownerClient.profile_id)
            .single();
          if (ownerProfile?.email) {
            const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.estatevault.us";
            const vetoUrl = `${baseUrl}/farewell/owner-veto?token=${vetoToken}`;
            await resend.emails.send({
              from: "EstateVault <info@estatevault.us>",
              to: ownerProfile.email,
              subject: "URGENT: Someone has requested access to your vault",
              html: `<div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:32px;color:#2D2D2D;">
                <h1 style="color:#1C3557;">Vault Access Requested</h1>
                <p>Hello ${ownerProfile.full_name || ""},</p>
                <p>A trustee has submitted a request to access your EstateVault. Their submission was reviewed by our team. If approved without action from you, vault access will be granted in <strong>72 hours</strong> (by ${expiresAt.toUTCString()}).</p>
                <p><strong>If you are alive and well, click the button below to cancel this request immediately.</strong></p>
                <div style="text-align:center;margin:32px 0;">
                  <a href="${vetoUrl}" style="background:#C9A84C;color:#fff;text-decoration:none;padding:14px 28px;border-radius:9999px;font-weight:600;">I'm alive — Cancel Access</a>
                </div>
                <p style="color:#6b7280;font-size:13px;">This link is single-use and expires in 72 hours. You will receive this email every 12 hours during the review window.</p>
                <p style="color:#9ca3af;font-size:11px;margin-top:24px;">EstateVault · Protecting what matters most</p>
              </div>`,
            });
          }
        }
      } catch (e) { console.error("[veto-email] send failed:", e); }


      // Unlock all farewell messages for this client
      await admin.from("farewell_messages").update({
        vault_farewell_status: "unlocked",
        unlocked_at: new Date().toISOString(),
      }).eq("client_id", verReq.client_id)
        .in("vault_farewell_status", ["locked", "pending_verification"]);

      // Get client name for email
      const { data: client } = await admin.from("clients").select("profile_id").eq("id", verReq.client_id).single();
      let clientName = "your loved one";
      if (client?.profile_id) {
        const { data: prof } = await admin.from("profiles").select("full_name").eq("id", client.profile_id).single();
        clientName = prof?.full_name || "your loved one";
      }

      // Get all unlocked messages and send emails to recipients
      const { data: unlockedMessages } = await admin
        .from("farewell_messages")
        .select("id, title, recipient_email")
        .eq("client_id", verReq.client_id)
        .eq("vault_farewell_status", "unlocked");

      try {
        for (const msg of unlockedMessages || []) {
          await resend.emails.send({
            from: "EstateVault <info@estatevault.us>",
            to: msg.recipient_email,
            subject: "A message has been left for you",
            html: `<div style="font-family:Inter,sans-serif;max-width:500px;margin:0 auto;padding:32px;"><h1 style="color:#1C3557;">A Message for You</h1><p>We're sorry for your loss.</p><p>${clientName} left you a farewell message titled "<strong>${msg.title}</strong>".</p><p>Click below to access it.</p><a href="https://www.estatevault.us/farewell/${verReq.client_id}" style="display:inline-block;background:#C9A84C;color:white;text-decoration:none;padding:14px 24px;border-radius:999px;font-weight:600;font-size:14px;">View Message</a><p style="color:#999;font-size:12px;margin-top:24px;">This link will remain accessible for you to view at any time.</p></div>`,
          });
        }
      } catch (emailErr) { console.error("Farewell unlock email failed:", emailErr); }

      await admin.from("audit_log").insert({
        actor_id: user.id,
        action: "farewell.unlocked",
        resource_type: "farewell_verification_request",
        resource_id: requestId,
        metadata: { client_id: verReq.client_id, messages_unlocked: unlockedMessages?.length || 0 },
      });

      return NextResponse.json({ success: true, action: "approved" });
    }

    if (action === "reject") {
      await admin.from("farewell_verification_requests").update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
        notes: notes || null,
      }).eq("id", requestId);

      // Reset messages back to locked
      await admin.from("farewell_messages").update({
        vault_farewell_status: "locked",
      }).eq("client_id", verReq.client_id)
        .eq("vault_farewell_status", "pending_verification");

      // Notify trustee
      try {
        await resend.emails.send({
          from: "EstateVault <info@estatevault.us>",
          to: verReq.trustee_email,
          subject: "Verification Update",
          html: `<div style="font-family:Inter,sans-serif;max-width:500px;margin:0 auto;padding:32px;"><h1 style="color:#1C3557;">Verification Update</h1><p>We were unable to verify the documentation you submitted. ${notes ? `<br><br>Reason: ${notes}` : ""}</p><p>If you believe this is an error, please resubmit with a clearer copy of the documentation.</p><p style="color:#999;font-size:12px;">- EstateVault</p></div>`,
        });
      } catch (emailErr) { console.error("Rejection email failed:", emailErr); }

      await admin.from("audit_log").insert({
        actor_id: user.id,
        action: "farewell.verification_rejected",
        resource_type: "farewell_verification_request",
        resource_id: requestId,
        metadata: { client_id: verReq.client_id },
      });

      return NextResponse.json({ success: true, action: "rejected" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Farewell verification action error:", error);
    return NextResponse.json({ error: "Failed to process" }, { status: 500 });
  }
}
