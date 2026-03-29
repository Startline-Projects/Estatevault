import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";

function createAdminClient() {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { cookies: { getAll: () => [], setAll: () => {} } });
}

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    const { data: client } = await admin.from("clients").select("id").eq("profile_id", user.id).single();
    if (!client) return NextResponse.json({ error: "No client record" }, { status: 400 });

    const { messageId, storagePath, fileSize, duration } = await request.json();
    if (!messageId || !storagePath) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify ownership
    const { data: message } = await admin
      .from("farewell_messages")
      .select("id")
      .eq("id", messageId)
      .eq("client_id", client.id)
      .single();

    if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });

    // Validate limits
    const fileSizeMb = (fileSize || 0) / (1024 * 1024);
    if (fileSizeMb > 500) {
      return NextResponse.json({ error: "File exceeds 500MB limit" }, { status: 400 });
    }
    if (duration && duration > 1800) {
      return NextResponse.json({ error: "Video exceeds 30-minute limit" }, { status: 400 });
    }

    await admin.from("farewell_messages").update({
      storage_path: storagePath,
      file_size_mb: Math.round(fileSizeMb * 100) / 100,
      duration_seconds: duration || null,
      updated_at: new Date().toISOString(),
    }).eq("id", messageId);

    await admin.from("audit_log").insert({
      actor_id: user.id,
      action: "farewell.uploaded",
      resource_type: "farewell_message",
      resource_id: messageId,
      metadata: { file_size_mb: fileSizeMb, duration_seconds: duration },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Upload complete error:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
