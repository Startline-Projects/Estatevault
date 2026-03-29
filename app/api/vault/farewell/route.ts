import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";

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
      return NextResponse.json({ error: "Failed to create message" }, { status: 500 });
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

    // Soft delete — mark as deleted, remove video from storage
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
