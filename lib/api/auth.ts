import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";

export type UserType = "client" | "partner" | "sales_rep" | "admin" | "attorney";

export function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

type AuthOk = {
  user: { id: string; email?: string };
  profile: { id: string; user_type: UserType };
  admin: ReturnType<typeof createAdminClient>;
};
type AuthErr = { error: NextResponse };

export async function requireAuth(allowed?: UserType[]): Promise<AuthOk | AuthErr> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, user_type")
    .eq("id", user.id)
    .single();
  if (!profile) {
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  if (allowed && !allowed.includes(profile.user_type as UserType)) {
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return {
    user: { id: user.id, email: user.email },
    profile: profile as { id: string; user_type: UserType },
    admin,
  };
}

export async function assertOrderAccess(
  admin: ReturnType<typeof createAdminClient>,
  orderId: string,
  profile: { id: string; user_type: UserType }
) {
  const { data: order } = await admin
    .from("orders")
    .select("id, client_id, partner_id, attorney_id")
    .eq("id", orderId)
    .single();
  if (!order) {
    return { error: NextResponse.json({ error: "not found" }, { status: 404 }) };
  }
  const t = profile.user_type;
  if (t === "admin") return { order };
  if (t === "client" && order.client_id === profile.id) return { order };
  if (t === "attorney" && order.attorney_id === profile.id) return { order };
  if (t === "partner") {
    const { data: partner } = await admin
      .from("partners")
      .select("id")
      .eq("profile_id", profile.id)
      .single();
    if (partner && order.partner_id === partner.id) return { order };
  }
  return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
}

const rateBuckets = new Map<string, { count: number; reset: number }>();
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const b = rateBuckets.get(key);
  if (!b || b.reset < now) {
    rateBuckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (b.count >= max) return false;
  b.count++;
  return true;
}
