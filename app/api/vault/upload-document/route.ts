import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";
import { randomUUID } from "crypto";

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Check subscription
  const { data: client } = await admin
    .from("clients")
    .select("id, vault_subscription_status")
    .eq("profile_id", user.id)
    .single();

  if (!client) return NextResponse.json({ error: "No client record" }, { status: 400 });
  if (client.vault_subscription_status !== "active") {
    return NextResponse.json({ error: "Vault subscription required" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const label = formData.get("label") as string | null;
  const docType = formData.get("doc_type") as string | null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!label?.trim()) return NextResponse.json({ error: "Label is required" }, { status: 400 });
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF files are allowed" }, { status: 400 });
  }

  // 20MB max
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "File must be under 20MB" }, { status: 400 });
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const storagePath = `vault/${client.id}/${randomUUID()}.pdf`;

  const { error: uploadErr } = await admin.storage
    .from("documents")
    .upload(storagePath, fileBuffer, { contentType: "application/pdf", upsert: false });

  if (uploadErr) {
    console.error("Vault doc upload error:", uploadErr);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }

  const { data: item, error: itemErr } = await admin
    .from("vault_items")
    .insert({
      client_id: client.id,
      category: "estate_document",
      label: label.trim(),
      data: {
        storage_path: storagePath,
        doc_type: docType || "Other",
        file_name: file.name,
        uploaded_at: new Date().toISOString(),
      },
    })
    .select()
    .single();

  if (itemErr) {
    console.error("Vault item insert error:", itemErr);
    return NextResponse.json({ error: itemErr.message }, { status: 500 });
  }

  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "vault.estate_doc_uploaded",
    resource_type: "vault_item",
    resource_id: item.id,
    metadata: { label: label.trim(), doc_type: docType },
  });

  return NextResponse.json({ item });
}
