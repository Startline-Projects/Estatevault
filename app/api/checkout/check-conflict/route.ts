import { NextResponse } from "next/server";
import { checkPlanConflict } from "@/lib/orders/plan-conflict";
import { apiRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/api/auth";
import { withRoute } from "@/lib/api/route";
import { checkConflictSchema } from "@/lib/validation/schemas";

export const POST = withRoute(async (request: Request) => {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "anon";
    const { success } = await apiRateLimit.limit(`conflict:${ip}`);
    if (!success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await request.json();
    const parsed = checkConflictSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid input", details: parsed.error.flatten() }, { status: 400 });
    }
    const { email, productType } = parsed.data;

    const supabase = createAdminClient();
    const result = await checkPlanConflict(supabase, email, productType);

    return NextResponse.json(result);
  } catch (e) {
    console.error("check-conflict error:", e);
    return NextResponse.json({ error: "Failed to check" }, { status: 500 });
  }
});
