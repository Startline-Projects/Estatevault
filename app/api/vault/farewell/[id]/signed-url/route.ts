import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import * as farewellRepo from "@/lib/repos/server/farewellRepo";
import * as clientRepo from "@/lib/repos/server/clientRepo";

export const GET = withRoute(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id: messageId } = await params;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Unauthorized", 401);

  const admin = createAdminClient();
  const { data: client } = await clientRepo.getIdByProfile(admin, user.id);
  if (!client) return fail("No client record", 400);

  const { data: message } = await farewellRepo.getById(admin, messageId);

  if (!message || !message.storage_path) {
    return fail("Message not found", 404);
  }

  // Owner can always view their own messages
  const isOwner = message.client_id === client.id;

  if (!isOwner) {
    // Non-owner can only view unlocked messages
    if (message.vault_farewell_status !== "unlocked") {
      return fail("Video is locked", 403);
    }
  }

  // Never generate signed URLs for deleted/replaced/expired messages
  if (["deleted", "replaced", "expired"].includes(message.vault_farewell_status)) {
    return fail("Video unavailable", 404);
  }

  const { data: urlData } = await admin.storage
    .from("farewell-videos")
    .createSignedUrl(message.storage_path, 604800); // 7 days

  if (!urlData?.signedUrl) {
    return fail("Failed to generate URL", 500);
  }

  // Audit log
  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: isOwner ? "farewell.owner_viewed" : "farewell.trustee_viewed",
    resource_type: "farewell_message",
    resource_id: messageId,
    metadata: { viewed_as: isOwner ? "owner" : "trustee" },
  });

  return ok({ signedUrl: urlData.signedUrl });
});
