import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import * as vaultItemRepo from "@/lib/repos/server/vaultItemRepo";
import * as clientRepo from "@/lib/repos/server/clientRepo";

export const GET = withRoute(async (request: NextRequest) => {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("item_id");
  if (!itemId) return fail("Missing item_id", 400);

  const admin = createAdminClient();

  // Verify ownership
  const { data: client } = await clientRepo.findIdAndSubByProfile(admin, user.id);

  if (!client) return fail("Unauthorized", 401);
  if (client.vault_subscription_status !== "active") {
    return fail("Vault subscription required", 403);
  }

  const { data: item } = await vaultItemRepo.getOwnerAndData(admin, itemId);

  if (!item || item.client_id !== client.id) {
    return fail("Not found", 404);
  }

  const itemData = item.data as Record<string, unknown>;
  const storagePath = itemData?.storage_path as string | null;
  if (!storagePath) return fail("No file attached", 404);

  const { data: signedUrl } = await admin.storage
    .from("documents")
    .createSignedUrl(storagePath, 3600);

  if (!signedUrl?.signedUrl) {
    return fail("Could not generate download link", 500);
  }

  return ok({ url: signedUrl.signedUrl });
});
