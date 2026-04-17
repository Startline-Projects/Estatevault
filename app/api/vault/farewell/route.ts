import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function createAdminClient() {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { cookies: { getAll: () => [], setAll: () => {} } });
}

export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    const { data: client } = await admin.from("clients").select("id").eq("profile_id", user.id).single();
    if (!client) return NextResponse.json({ error: "No client record" }, { status: 400 });

    const { data: messages } = await admin
      .from("farewell_messages")
      .select("id, title, recipient_email, file_size_mb, duration_seconds, vault_farewell_status, created_at, updated_at")
      .eq("client_id", client.id)
      .not("vault_farewell_status", "in", '("deleted","replaced","expired")')
      .order("created_at", { ascending: false });

    return NextResponse.json({ messages: messages || [] });
  } catch (error) {
    console.error("Farewell list error:", error);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    const { data: client } = await admin
      .from("clients")
      .select("id, vault_subscription_status")
      .eq("profile_id", user.id)
      .single();
    if (!client) return NextResponse.json({ error: "No client record" }, { status: 400 });

    if (client.vault_subscription_status !== "active") {
      return NextResponse.json({ error: "Vault subscription required" }, { status: 403 });
    }

    const { title, recipientEmail } = await request.json();
    if (!title || !recipientEmail) {
      return NextResponse.json({ error: "Title and recipient email are required" }, { status: 400 });
    }

    // Get sender's name for the notification email
    const { data: senderProfile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();
    const senderName = senderProfile?.full_name || "Someone you know";

    const { data: message, error: insertErr } = await admin
      .from("farewell_messages")
      .insert({
        client_id: client.id,
        title,
        recipient_email: recipientEmail,
        vault_farewell_status: "locked",
      })
      .select("id")
      .single();

    if (insertErr || !message) {
      console.error("Farewell insert error:", insertErr);
      return NextResponse.json({ error: "Failed to create message" }, { status: 500 });
    }

    // Send notification email to recipient so they know the link exists
    const accessLink = `https://www.estatevault.us/farewell/${client.id}`;
    try {
      await resend.emails.send({
        from: "EstateVault <info@estatevault.us>",
        to: recipientEmail,
        subject: `${senderName} has left you a farewell message`,
        html: `
          <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:32px;">
            <h1 style="color:#1C3557;font-size:22px;margin-bottom:8px;">A Message Has Been Prepared for You</h1>
            <p style="color:#2D2D2D;font-size:15px;line-height:1.6;">
              <strong>${senderName}</strong> has recorded a personal farewell message titled
              "<strong>${title}</strong>" and designated you as the recipient.
            </p>
            <p style="color:#2D2D2D;font-size:15px;line-height:1.6;">
              This message is securely stored and <strong>locked</strong>. It will only become
              accessible after a verified death certificate is submitted and reviewed by our team.
            </p>
            <p style="color:#2D2D2D;font-size:15px;line-height:1.6;margin-top:24px;">
              <strong>Save this link</strong>, when the time comes, click it to request access:
            </p>
            <div style="margin:24px 0;">
              <a href="${accessLink}"
                style="display:inline-block;background:#C9A84C;color:white;text-decoration:none;
                       padding:14px 28px;border-radius:999px;font-weight:600;font-size:14px;">
                Access Farewell Messages
              </a>
            </div>
            <p style="color:#999;font-size:12px;line-height:1.6;">
              You will need to upload a death certificate to verify your request. Our team reviews
              all submissions within 24-48 hours. You will be notified by email once access is granted.
            </p>
            <p style="color:#999;font-size:12px;margin-top:16px;">- EstateVault</p>
          </div>
        `,
      });
    } catch (emailErr) {
      // Don't fail the request if email fails, message was already created
      console.error("Farewell notification email failed:", emailErr);
    }

    await admin.from("audit_log").insert({
      actor_id: user.id,
      action: "farewell.created",
      resource_type: "farewell_message",
      resource_id: message.id,
      metadata: { title, recipient_email: recipientEmail },
    });

    return NextResponse.json({ messageId: message.id });
  } catch (error) {
    console.error("Farewell create error:", error);
    return NextResponse.json({ error: "Failed to create message" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    const { data: client } = await admin.from("clients").select("id").eq("profile_id", user.id).single();
    if (!client) return NextResponse.json({ error: "No client record" }, { status: 400 });

    const { messageId, title, recipientEmail } = await request.json();
    if (!messageId) return NextResponse.json({ error: "Missing messageId" }, { status: 400 });

    // Verify ownership and status
    const { data: existing } = await admin
      .from("farewell_messages")
      .select("id, vault_farewell_status")
      .eq("id", messageId)
      .eq("client_id", client.id)
      .single();

    if (!existing) return NextResponse.json({ error: "Message not found" }, { status: 404 });
    if (existing.vault_farewell_status === "unlocked") {
      return NextResponse.json({ error: "Cannot edit unlocked messages" }, { status: 400 });
    }

    const updates: Record<string, string> = { updated_at: new Date().toISOString() };
    if (title) updates.title = title;
    if (recipientEmail) updates.recipient_email = recipientEmail;

    await admin.from("farewell_messages").update(updates).eq("id", messageId);

    const action = recipientEmail ? "farewell.recipient_updated" : "farewell.updated";
    await admin.from("audit_log").insert({
      actor_id: user.id,
      action,
      resource_type: "farewell_message",
      resource_id: messageId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Farewell update error:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    const { data: client } = await admin.from("clients").select("id").eq("profile_id", user.id).single();
    if (!client) return NextResponse.json({ error: "No client record" }, { status: 400 });

    const { messageId } = await request.json();
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

    // Soft delete, mark as deleted, remove video from storage
    if (existing.storage_path) {
      await admin.storage.from("farewell-videos").remove([existing.storage_path]);
    }

    await admin.from("farewell_messages").update({
      vault_farewell_status: "deleted",
      deleted_at: new Date().toISOString(),
      storage_path: null,
    }).eq("id", messageId);

    // Cancel any pending verification requests
    await admin.from("farewell_verification_requests")
      .update({ status: "rejected", notes: "Message deleted by owner" })
      .eq("client_id", client.id)
      .eq("status", "pending");

    await admin.from("audit_log").insert({
      actor_id: user.id,
      action: "farewell.owner_deleted",
      resource_type: "farewell_message",
      resource_id: messageId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Farewell delete error:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
