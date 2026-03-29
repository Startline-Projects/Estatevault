import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

// Public endpoint — returns document status for an order
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("order_id");

    if (!orderId) {
      return NextResponse.json({ error: "Missing order_id" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: docs } = await supabase
      .from("documents")
      .select("id, document_type, status, storage_path")
      .eq("order_id", orderId);

    if (!docs || docs.length === 0) {
      return NextResponse.json({ ready: false, documents: [] });
    }

    const allReady = docs.every((d) => d.status === "generated" || d.status === "delivered");

    return NextResponse.json({
      ready: allReady,
      documents: docs.map((d) => ({
        id: d.id,
        document_type: d.document_type,
        status: d.status,
        has_file: !!d.storage_path,
      })),
    });
  } catch {
    return NextResponse.json({ ready: false, documents: [] });
  }
}
