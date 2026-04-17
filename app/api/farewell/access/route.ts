import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

// POST /api/farewell/access
// Trustee verifies identity and gets signed URLs for unlocked messages.
// No auth required, trustee is not a Supabase user.
export async function POST(request: Request) {
  try {
    const { clientId, trusteeEmail } = await request.json();

    if (!clientId || !trusteeEmail) {
      return NextResponse.json({ error: "Missing clientId or trusteeEmail" }, { status: 400 });
    }

    const admin = createAdminClient();

    // 1. Verify this email is a registered trustee for this client
    const { data: trustee } = await admin
      .from("vault_trustees")
      .select("id, trustee_name")
      .eq("client_id", clientId)
      .eq("trustee_email", trusteeEmail.toLowerCase().trim())
      .single();

    if (!trustee) {
      return NextResponse.json(
        { error: "No trustee account found for this email. Please check your email address." },
        { status: 404 }
      );
    }

    // 2. Check if there are unlocked messages for this client
    const { data: messages } = await admin
      .from("farewell_messages")
      .select("id, title, duration_seconds, storage_path")
      .eq("client_id", clientId)
      .eq("vault_farewell_status", "unlocked");

    if (!messages || messages.length === 0) {
      // Check if there are pending verification messages instead
      const { data: pending } = await admin
        .from("farewell_messages")
        .select("id")
        .eq("client_id", clientId)
        .in("vault_farewell_status", ["locked", "pending_verification"])
        .limit(1);

      if (pending && pending.length > 0) {
        return NextResponse.json({ state: "pending" });
      }

      return NextResponse.json({ state: "no_messages" });
    }

    // 3. Generate signed URLs for all unlocked messages with video
    const videoMessages = [];
    for (const msg of messages) {
      if (!msg.storage_path) continue;

      const { data: signedUrl } = await admin.storage
        .from("farewell-videos")
        .createSignedUrl(msg.storage_path, 3600); // 1-hour expiry

      if (signedUrl?.signedUrl) {
        videoMessages.push({
          id: msg.id,
          title: msg.title,
          duration_seconds: msg.duration_seconds,
          signedUrl: signedUrl.signedUrl,
        });
      }
    }

    if (videoMessages.length === 0) {
      return NextResponse.json({ state: "no_messages" });
    }

    // 4. Audit the access
    await admin.from("audit_log").insert({
      action: "farewell.trustee_accessed",
      resource_type: "farewell_message",
      resource_id: messages[0].id,
      metadata: { client_id: clientId, trustee_email: trusteeEmail, messages_accessed: videoMessages.length },
    });

    return NextResponse.json({
      state: "unlocked",
      trusteeName: trustee.trustee_name,
      messages: videoMessages,
    });
  } catch (error) {
    console.error("Farewell access error:", error);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
