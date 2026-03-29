import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";

function createAdminClient() {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { cookies: { getAll: () => [], setAll: () => {} } });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: messageId } = await params;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    const { data: client } = await admin.from("clients").select("id").eq("profile_id", user.id).single();
    if (!client) return NextResponse.json({ error: "No client record" }, { status: 400 });

    const { data: message } = await admin
      .from("farewell_messages")
      .select("id, storage_path, vault_farewell_status, client_id")
      .eq("id", messageId)
      .single();

    if (!message || !message.storage_path) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Owner can always view their own messages
    const isOwner = message.client_id === client.id;

    if (!isOwner) {
      // Non-owner can only view unlocked messages
      if (message.vault_farewell_status !== "unlocked") {
        return NextResponse.json({ error: "Video is locked" }, { status: 403 });
      }
    }

    // Never generate signed URLs for deleted/replaced/expired messages
    if (["deleted", "replaced", "expired"].includes(message.vault_farewell_status)) {
      return NextResponse.json({ error: "Video unavailable" }, { status: 404 });
    }

    const { data: urlData } = await admin.storage
      .from("farewell-videos")
      .createSignedUrl(message.storage_path, 604800); // 7 days

    if (!urlData?.signedUrl) {
      return NextResponse.json({ error: "Failed to generate URL" }, { status: 500 });
    }

    // Audit log
    await admin.from("audit_log").insert({
      actor_id: user.id,
      action: isOwner ? "farewell.owner_viewed" : "farewell.trustee_viewed",
      resource_type: "farewell_message",
      resource_id: messageId,
      metadata: { viewed_as: isOwner ? "owner" : "trustee" },
    });

    return NextResponse.json({ signedUrl: urlData.signedUrl });
  } catch (error) {
    console.error("Signed URL error:", error);
    return NextResponse.json({ error: "Failed to generate URL" }, { status: 500 });
  }
}
