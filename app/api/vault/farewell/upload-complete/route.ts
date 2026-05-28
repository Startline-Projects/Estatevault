import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { farewellUploadCompleteSchema } from "@/lib/validation/schemas";
import * as farewellRepo from "@/lib/repos/server/farewellRepo";
import * as clientRepo from "@/lib/repos/server/clientRepo";

export const POST = withRoute(async (request: NextRequest) => {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Unauthorized", 401);

  const admin = createAdminClient();
  const { data: client } = await clientRepo.getIdByProfile(admin, user.id);
  if (!client) return fail("No client record", 400);

  const body = await request.json();
  const parsed = farewellUploadCompleteSchema.safeParse(body);
  if (!parsed.success) return fail("invalid payload", 400);
  const { messageId, storagePath, fileSize, duration } = parsed.data;

  // Verify ownership
  const { data: message } = await farewellRepo.getIdForOwner(admin, messageId, client.id);

  if (!message) return fail("Message not found", 404);

  // Validate limits
  const fileSizeMb = (fileSize || 0) / (1024 * 1024);

  await farewellRepo.updateForOwner(admin, messageId, client.id, {
    storage_path: storagePath,
    file_size_mb: Math.round(fileSizeMb * 100) / 100,
    duration_seconds: duration || null,
    updated_at: new Date().toISOString(),
  });

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "farewell.uploaded",
    resource_type: "farewell_message",
    resource_id: messageId,
    metadata: { file_size_mb: fileSizeMb, duration_seconds: duration },
  });

  return ok({ success: true });
});
