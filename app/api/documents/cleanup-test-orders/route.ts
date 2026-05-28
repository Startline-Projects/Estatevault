export const dynamic = "force-dynamic";

import { type NextRequest } from "next/server";
import { withRoute } from "@/lib/api/route";
import { ok, fail } from "@/lib/api/response";
import { createAdminClient } from "@/lib/api/auth";
import * as auditLogRepo from "@/lib/repos/server/auditLogRepo";

export const GET = withRoute(async (request: NextRequest) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return fail("unauthorized", 401);
  }

  const supabase = createAdminClient();

  const { data: expiredOrders } = await supabase
    .from("orders")
    .select("id")
    .eq("order_type", "test")
    .lt("expires_at", new Date().toISOString());

  if (!expiredOrders || expiredOrders.length === 0) {
    return ok({ message: "No expired test orders", cleaned: 0 });
  }

  let cleaned = 0;

  for (const order of expiredOrders) {
    const { data: docs } = await supabase
      .from("documents")
      .select("storage_path")
      .eq("order_id", order.id)
      .not("storage_path", "is", null);

    if (docs && docs.length > 0) {
      const paths = docs.map((d) => d.storage_path!).filter(Boolean);
      if (paths.length > 0) {
        await supabase.storage.from("documents").remove(paths);
      }
    }

    await supabase.from("documents").delete().eq("order_id", order.id);

    const { data: orderData } = await supabase
      .from("orders")
      .select("quiz_session_id")
      .eq("id", order.id)
      .single();

    if (orderData?.quiz_session_id) {
      await supabase.from("quiz_sessions").delete().eq("id", orderData.quiz_session_id);
    }

    await supabase.from("orders").delete().eq("id", order.id);
    cleaned++;
  }

  if (cleaned > 0) {
    await auditLogRepo.insertEntry(supabase, {
      action: "test_orders.cleaned",
      resource_type: "order",
      metadata: { orders_cleaned: cleaned },
    });
  }

  return ok({ message: "Cleanup complete", cleaned });
});
