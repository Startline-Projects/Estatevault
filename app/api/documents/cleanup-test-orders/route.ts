import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

// Runs hourly via Vercel cron, deletes expired test orders and their files
export async function GET() {
  try {
    const supabase = createAdminClient();

    // Find expired test orders
    const { data: expiredOrders } = await supabase
      .from("orders")
      .select("id")
      .eq("order_type", "test")
      .lt("expires_at", new Date().toISOString());

    if (!expiredOrders || expiredOrders.length === 0) {
      return NextResponse.json({ message: "No expired test orders", cleaned: 0 });
    }

    let cleaned = 0;

    for (const order of expiredOrders) {
      // Get document storage paths
      const { data: docs } = await supabase
        .from("documents")
        .select("storage_path")
        .eq("order_id", order.id)
        .not("storage_path", "is", null);

      // Delete files from storage
      if (docs && docs.length > 0) {
        const paths = docs.map((d) => d.storage_path!).filter(Boolean);
        if (paths.length > 0) {
          await supabase.storage.from("documents").remove(paths);
        }
      }

      // Delete document records
      await supabase.from("documents").delete().eq("order_id", order.id);

      // Delete quiz session if linked
      const { data: orderData } = await supabase
        .from("orders")
        .select("quiz_session_id")
        .eq("id", order.id)
        .single();

      if (orderData?.quiz_session_id) {
        await supabase.from("quiz_sessions").delete().eq("id", orderData.quiz_session_id);
      }

      // Delete the order
      await supabase.from("orders").delete().eq("id", order.id);

      cleaned++;
    }

    // Audit log
    if (cleaned > 0) {
      await supabase.from("audit_log").insert({
        action: "test_orders.cleaned",
        resource_type: "order",
        metadata: { orders_cleaned: cleaned },
      });
    }

    return NextResponse.json({ message: "Cleanup complete", cleaned });
  } catch (error) {
    console.error("Test order cleanup error:", error);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}
