import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("item_id");
  if (!itemId) return NextResponse.json({ error: "Missing item_id" }, { status: 400 });

  const admin = createAdminClient();

  // Verify ownership
  const { data: client } = await admin
    .from("clients")
    .select("id, vault_subscription_status")
    .eq("profile_id", user.id)
    .single();

  if (!client) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (client.vault_subscription_status !== "active") {
    return NextResponse.json({ error: "Vault subscription required" }, { status: 403 });
  }

  const { data: item } = await admin
    .from("vault_items")
    .select("client_id, data")
    .eq("id", itemId)
    .single();

  if (!item || item.client_id !== client.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const itemData = item.data as Record<string, unknown>;
  const storagePath = itemData?.storage_path as string | null;
  if (!storagePath) return NextResponse.json({ error: "No file attached" }, { status: 404 });

  const { data: signedUrl } = await admin.storage
    .from("documents")
    .createSignedUrl(storagePath, 3600);

  if (!signedUrl?.signedUrl) {
    return NextResponse.json({ error: "Could not generate download link" }, { status: 500 });
  }

  return NextResponse.json({ url: signedUrl.signedUrl });
}
