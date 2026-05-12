import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { checkPlanConflict, type ProductType } from "@/lib/orders/plan-conflict";
import { apiRateLimit } from "@/lib/rate-limit";

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

export async function POST(request: Request) {
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
    const { email, productType } = body as {
      email?: string;
      productType?: ProductType;
    };

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    if (productType !== "will" && productType !== "trust") {
      return NextResponse.json({ error: "Invalid productType" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const result = await checkPlanConflict(supabase, email, productType);

    return NextResponse.json(result);
  } catch (e) {
    console.error("check-conflict error:", e);
    return NextResponse.json({ error: "Failed to check" }, { status: 500 });
  }
}
